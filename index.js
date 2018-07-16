'use strict';
const { ApolloServer, gql } = require('apollo-server');
const { PubSub } = require('graphql-subscriptions');
const { withFilter } = require('graphql-subscriptions');
const { makeExecutableSchema } = require('graphql-tools');

const pubsub = new PubSub();
pubsub.publish

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

const messages = [
  {
    id: 'message1',
    from: "user1",
    to: "user2",
    text: 'Hello Hermione!',
  },
  {
    id: 'message2',
    from: "user2",
    to: "user1",
    text: 'Hello Harry!',
  },
  {
    id: 'message3',
    from: "user3",
    to: "user1",
    text: 'Hello Harry from Dumbledore!',
  },
];

var getUniqueID = (function() {
        var cntr = 0;
        return function() {
          return cntr++;
        };
      })();


// Type definitions define the "shape" of your data and specify
// which ways the data can be fetched from the GraphQL server.
const typeDefs = gql`
  
  type User {
    id:	String!
    name: String
    email: String
    address: String
  }

 type Message {
    id: String!
    from: String!
    to: String!
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
      const newMessage = { id: getUniqueID(), from: args.from, to: args.to, text: args.text, date: new Date()};

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
        return payload.newMessage.from === variables.from;
      }),
    }
  },

};

// // In the most basic sense, the ApolloServer can be started
// // by passing type definitions (typeDefs) and the resolvers
// // responsible for fetching the data for those types.
// const server = new ApolloServer({ typeDefs, resolvers });

// // This `listen` method launches a web-server.  Existing apps
// // can utilize middleware options.
// server.listen().then(({ url }) => {
//   console.log(`🚀  Server ready at ${url}`);
// });



const express = require('express');
const { graphqlExpress, graphiqlExpress } = require('apollo-server-express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { execute, subscribe } = require('graphql');
const { createServer } = require('http');
const { SubscriptionServer } = require('subscriptions-transport-ws');

const PORT = 3000;
const server = express();

server.use('*', cors({ origin: 'http://localhost:${PORT}' }));

const schema = makeExecutableSchema({typeDefs, resolvers});

server.use('/graphql', bodyParser.json(), graphqlExpress({
  schema
}));

server.use('/graphiql', graphiqlExpress({
  endpointURL: '/graphql',
  subscriptionsEndpoint: 'ws://localhost:${PORT}/subscriptions'
}));

// Wrap the Express server
const ws = createServer(server);
ws.listen(PORT, () => {
  console.log('Apollo Server is now running on http://localhost:${PORT}');
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


