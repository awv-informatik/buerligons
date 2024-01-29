# buerligons

buerli's CAD application.

## Getting Started

### Install dependencies

First of all you need to install all required dependencies.

```
yarn install
```

> Note about node.js compatiblity of the development tools used for buerligons. A github action is used to install dependencies on several node.js versions. Please have a look at the github action [build.yml](./.github/workflows/build.yml) to see what node.js versions are tested. We recommend to use `nvm` to easily switch to another compatible version in case of problems with the node.js version you are currently running on your system.

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
