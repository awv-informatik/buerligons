# buerligons

A user-friendly interactive CAD application

First, clone the repository

```shell
git clone https://github.com/awv-informatik/buerligons
cd buerligons
yarn
```

### Create an account and get your ClassCAD key

In order for **buerligons** to work, you need to have a running ClassCAD. You can either run it in the browser using WASM or connect to a local or remote ClassCAD server using SocketIO.

### Running ClassCAD using WASM

Follow the instruction points 1-3 about **"Create an account and get your ClassCAD key"** on [Getting Started with WASM](https://buerli.io/docs/quickstart/wasm).

Copy your created ClassCAD WASM key into the .env file at `CLASSCAD_WASM_KEY=` in the root of this project. The variable `SOCKETIO_URL` is not relevant in this case.

```shell
CLASSCAD_WASM_KEY=MS4xLlZZUG51....
SOCKETIO_URL=ws://localhost:9091
```

### Running ClassCAD using SocketIO

Follow the instruction points 1-3 about **"Create an account, get your ClassCAD key, download ClassCAD"** on [Getting Started with SocketIO](https://buerli.io/docs/quickstart/socketio)

Start ClassCAD via SocketIO as described in the [Downloads](https://classcad.ch/downloads/) page

Open the .env file in the root of this project and comment out `CLASSCAD_WASM_KEY` to make sure ClassCAD is not running via SocketIO

```shell
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
