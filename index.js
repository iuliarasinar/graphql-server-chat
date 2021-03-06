'use strict';
const { ApolloServer, gql } = require('apollo-server');
const { PubSub } = require('graphql-subscriptions');
const { withFilter } = require('graphql-subscriptions');
const { makeExecutableSchema } = require('graphql-tools');
const express = require('express');
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { execute, subscribe } = require('graphql');
const { createServer } = require('http');
const { SubscriptionServer } = require('subscriptions-transport-ws');

// This is a collection of users and messages we'll be able to query
// the GraphQL server for.  A more complete example might fetch
// from an existing data source like a REST API or database.
const users = [
  new User("user1", "Harry Potter", "harry@mail.com", "4 Privet Drive"),
  new User("user2", "Hermione Granger", "hermione@mail.com", ""),
  new User("user3", "Albus Dumbledore"),
];

function User (id, name, email, address) {
    this.id = id;
    this.name = name;
    this.email = email;
    this.address = address;
};

const messages = [];

var getUniqueID = (function() {
        var cntr = 0;
        return function() {
          return cntr++;
        };
      })();

const pubsub = new PubSub();

// Type definitions define the "shape" of your data and specify how 
// it can be fetched from the GraphQL server.
const typeDefs = gql`
  
  type User {
    id:	String!
    name: String
    email: String
    address: String
  }

 type Message {
    id: String!
    from: User!
    to: User!
    text: String!
    date: String
  }

  type Query {
    users: [User]
  }

  type Mutation {
    addMessage(from: String!, to: String!, text: String!): Message
  }

  type Subscription {
    newMessage(from: String!, to:String!): Message
  }
`;

// Resolvers define the technique for fetching the types in the schema.  
// We'll retrieve users from the "users" array above, add new message and create subscription for when message was added.
const resolvers = {
  Query: {
    users: () => users,
  },

  Mutation: {
    addMessage: (root, args) => {
      const newMessage = { id: getUniqueID(), from: new User(args.from), to: new User(args.to), text: args.text, date: new Date()};

      const payload = {
        newMessage: {
          id: newMessage.id,
          from: newMessage.from,
          to: newMessage.to,
          text: newMessage.text,
          date: newMessage.date
        }
      };
 	
      pubsub.publish('newMessage', payload);

      messages.push(newMessage);
      return newMessage;
    },
  },

  Subscription: {
    newMessage: {
      subscribe: withFilter(() => pubsub.asyncIterator('newMessage'), (payload, variables) => {
        return payload.newMessage.from.id === variables.from;
      }),
    }
  },
};

const schema = makeExecutableSchema({typeDefs, resolvers});

const port = 3000;
const server = express();
server.use('*', cors({ origin: 'http://localhost:$port' }));

server.use('/graphql', bodyParser.json(), graphqlExpress({
  schema
}));

server.use('/graphiql', graphiqlExpress({
  endpointURL: '/graphql',
  subscriptionsEndpoint: 'ws://localhost:$port/subscriptions'
}));

// Wrap the Express server
const ws = createServer(server);
ws.listen(port, () => {
  console.log(" 🚀  Server ready at http://localhost:%s", port);
  // Set up the WebSocket for handling GraphQL subscriptions
  new SubscriptionServer({
    execute,
    subscribe,
    schema
  }, {
    server: ws,
    path: '/subscriptions',
  });
});


