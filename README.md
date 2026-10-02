# buerligons

A user-friendly interactive CAD application

First, clone the repository

```shell
git clone https://github.com/awv-informatik/buerligons
cd buerligons
yarn
```

### Create an account and get your ClassCAD key

In order for **buerligons** to work, you need to have a running ClassCAD. You can connect to a ClassCAD worker over WebSocket, run ClassCAD in the browser using WASM, or connect to a local or remote ClassCAD server using SocketIO.

Which one is used is set in the .env file in the root of this project: the first of `WSCLIENT_URL`, `CLASSCAD_WASM_KEY` and `SOCKETIO_URL` that is set.

### Running ClassCAD as a worker (the default)

Start a ClassCAD worker (`classcad-cli worker`). It listens on port 9094, which is where the .env file points:

```shell
WSCLIENT_URL=ws://localhost:9094
```

A worker shares its session: the **Session Management** button in the dock opens the invite panel, where you create invite links to edit or to view. A page opened with such a link (`?invite=...`) joins the session as a guest.

### Running ClassCAD using WASM

Follow the instruction points 1-3 about **"Create an account and get your ClassCAD key"** on [Getting Started with WASM](https://buerli.io/docs/quickstart/wasm).

Open the .env file, comment out `WSCLIENT_URL` and copy your created ClassCAD WASM key to `CLASSCAD_WASM_KEY=`. The variable `SOCKETIO_URL` is not relevant in this case.

> The first time ClassCAD starts using WASM, loading may take some time depending on your internet speed.

```shell
#WSCLIENT_URL=ws://localhost:9094
CLASSCAD_WASM_KEY=MS4xLlZZUG51....
SOCKETIO_URL=ws://localhost:9091
```

### Running ClassCAD using SocketIO

Follow the instruction points 1-3 about **"Create an account, get your ClassCAD key, download ClassCAD"** on [Getting Started with SocketIO](https://buerli.io/docs/quickstart/socketio)

Start ClassCAD via SocketIO as described in the [Downloads](https://classcad.ch/downloads/) page

Open the .env file and comment out `WSCLIENT_URL` and `CLASSCAD_WASM_KEY` to make sure ClassCAD is reached over SocketIO

```shell
#WSCLIENT_URL=ws://localhost:9094
#CLASSCAD_WASM_KEY=MS4xLlZZUG51....
SOCKETIO_URL=ws://localhost:9091
```

### Run buerligons

```shell
yarn start
```

The buerligons application is now available at http://localhost:5173.

> Please check the console output for possible node incompatiblities of the development tools. In case of problems, the use of `nvm` is recommended. `nvm` allows installing different Node versions on the same system.

### Links to our homepages and documentations

- [buerligons.io](https://buerligons.io)
- [buerli.io](https://buerli.io)
- [classcad.ch](https://classcad.ch)
- [awv-informatik.ch](https://awv-informatik.ch)
