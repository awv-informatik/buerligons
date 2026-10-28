# buerligons

A user-friendly interactive CAD application

First, clone the repository

```shell
git clone https://github.com/awv-informatik/buerligons
cd buerligons
yarn
```

### Create an account and get your ClassCAD access token

In order for **buerligons** to work, you need to have a running ClassCAD. By default buerligons connects to a local or remote ClassCAD server using SocketIO. Alternatively it can run ClassCAD in the browser using WASM.

The connection is configured in the `.env` file in the root of this project. Put personal values such as your access token into an untracked `.env.local` next to it; Vite loads it on top of `.env`, so your token never ends up in git.

### Running ClassCAD using SocketIO (default)

Follow the instruction points 1-3 about **"Create an account, get your ClassCAD key, download ClassCAD"** on [Getting Started with SocketIO](https://buerli.io/docs/quickstart/socketio)

Start ClassCAD via SocketIO as described in the [Downloads](https://classcad.ch/downloads/) page

Make sure `CLASSCAD_TOKEN` stays commented out in `.env` and `SOCKETIO_URL` points to your server:

```shell
#CLASSCAD_TOKEN=ccpk_....
SOCKETIO_URL=ws://localhost:9091
```

### Running ClassCAD using WASM

Create an account on [classcad.ch](https://classcad.ch) and create a **public** access token (`ccpk_...`) on your [account page](https://classcad.ch/account). See [Getting Started with WASM](https://buerli.io/docs/quickstart/wasm) for details.

Create a `.env.local` file in the root of this project and set your token there. It takes precedence over the commented out line in `.env`, and `SOCKETIO_URL` is not relevant in this case.

```shell
CLASSCAD_TOKEN=ccpk_....
```

The token is exchanged for a short-lived engine key by the client and renewed automatically, so it does not expire like the former WASM keys. A public token works on localhost and on the domains registered in your account. Never put a secret token (`ccsk_...`) into this file, it would end up in the web page.

> The first time ClassCAD starts using WASM, loading may take some time depending on your internet speed.

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
