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

#### Download ccapp

Go to [buerli.io](https://buerli.io), sign up for a **user account** and download the required application package. Copy the downloaded `ccapp` side by side to this REAMDE in the root folder of the project and rename it to `BaseModeling.ccapp`

#### Start the server

**Windows:**

If you are on Windows, you can start the classcad server from this package.

```
yarn classcad
```
The server should now be available at http://localhost:8182. Please check the status:

```
http://localhost:8182/status
```



**Linux/OSX:**

You need to run the ClassCAD Server in Docker. Please follow the instructions here [@classcad/linux-x64](https://www.npmjs.com/package/@classcad/linux-x64).


### Client

Just start the development server and open the URL http://localhost:3000. Please note that it may take a moment until the development server is online.

```
yarn start
```

After that, you can directly load the sample models contained in this repository (`samples` folder) for a quick and uncomplicated start.
