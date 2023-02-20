# buerligons

buerli's CAD application.

## Getting Started

### Install dependencies

First of all you need to install all required dependencies.

```
yarn install
```

### ClassCAD Server

To be able to use buerligons, you need a running ClassCAD Server which offers the CAD service via WebSockets.

Please follow the instructions in the documentation to get a running service.
https://buerli.io/docs/setup-environment/server

### Client

Just start the development server and open the URL http://localhost:3000. Please note that it may take a moment until the development server is online.

```
yarn start
```

After that, you can directly load the sample models contained in this repository (`samples` folder) for a quick and uncomplicated start.

> Depending on your server setup, please change the `CCSERVERURL` in `src/initBuerli.ts`.
