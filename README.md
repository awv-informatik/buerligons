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

Which one is used is set in the .env file in the root of this project: the first of `WSCLIENT_URL`, `CLASSCAD_TOKEN` (or `CLASSCAD_WASM_KEY`) and `SOCKETIO_URL` that is set.

### Running ClassCAD as a worker (the default)

Start a ClassCAD worker (`classcad-cli worker`). It listens on port 9094, which is where the .env file points:

```shell
WSCLIENT_URL=ws://localhost:9094
```

A worker shares its session: the **Session Management** button in the dock opens the invite panel, where you create invite links to edit or to view. A page opened with such a link (`?invite=...`) joins the session as a guest.

### Running ClassCAD using WASM

The engine needs a key, and buerligons carries none. Sign in on [classcad.ch/account](https://classcad.ch/account) (a new account comes with two weeks of Solo) and make a **public access token** there. Open the .env file, comment out `WSCLIENT_URL` and put the token into `CLASSCAD_TOKEN=`. When the page starts, it asks ClassCAD for the key your plan allows for this page's origin (`localhost` works on every plan; other domains are registered on the account page with Pro and Business), keeps it until shortly before it expires, and renews it. The menus save in the formats your plan includes. `CLASSCAD_WASM_KEY` takes a key of your own instead of a token. The variable `SOCKETIO_URL` is not relevant in this case.

> The first time ClassCAD starts using WASM, loading may take some time depending on your internet speed.

```shell
#WSCLIENT_URL=ws://localhost:9094
CLASSCAD_TOKEN=ccpk_....
SOCKETIO_URL=ws://localhost:9091
```

With the engine in the page, the page hosts its session itself, and the **Session Management** panel creates invite links here too. Nobody can connect to a page, so its guests are introduced by a [ClassCAD MCP](https://github.com/awv-informatik/classcad-ai/tree/master/packages/mcp) running on the same machine: an AI agent joins with the link, and so does another page opened with it. The page looks for the MCP on `ws://127.0.0.1:9098/session`; `CLASSCAD_SESSION_URL` in the .env file names another address. While no MCP runs there, the links cannot be joined.

### Running ClassCAD using SocketIO

Follow the instruction points 1-3 about **"Create an account, get your ClassCAD key, download ClassCAD"** on [Getting Started with SocketIO](https://buerli.io/docs/quickstart/socketio)

Start ClassCAD via SocketIO as described in the [Downloads](https://classcad.ch/downloads/) page

Open the .env file and comment out `WSCLIENT_URL` and `CLASSCAD_TOKEN` to make sure ClassCAD is reached over SocketIO

```shell
#WSCLIENT_URL=ws://localhost:9094
#CLASSCAD_TOKEN=ccpk_....
SOCKETIO_URL=ws://localhost:9091
```

### Working with an AI agent

In a shared session buerligons says what is selected and selects what the others ask for. An AI agent in the session (a ClassCAD MCP that joined with an invite link) therefore knows what "this face" means, and can point something out to you. You both work on the same model: what the agent builds appears as it happens, and what you change is what the agent reads next. This works with a worker and with WASM alike.

### buerligons as the app of a ClassCAD MCP

It also works the other way around: a ClassCAD MCP brings buerligons along as the app of its sessions. There the agent's session is the host, and the page joins it as a guest. That is a build of its own:

```shell
yarn build:mcp
```

It is vite's `mcp` mode and reads `.env.mcp`: `WSCLIENT_URL=/session` is an address without a scheme, taken on the server the page came from, because the MCP serves the app and its session on the same local address. The page is opened with the link the agent hands out (`?invite=...`); it has no welcome screen of its own, **New** starts the shared model over, and the File menu saves in the formats the session offers. In the classcad-ai repository `npm run build:app -w @classcad/mcp` runs this build and puts it into the MCP package.

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
