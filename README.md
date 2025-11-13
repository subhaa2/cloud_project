## 1. Prerequisites & Setup

New teammates must complete these one-time steps to ensure proper development and database authentication.

### 1.1. Node.js Environment (Required Version)

Your project requires a specific version of Node.js. Use **Node Version Manager (nvm)** for simple installation and switching.

1.  **Install nvm** (Search for "nvm install" for platform-specific instructions).
2.  Once nvm is installed, run these commands in the terminal:
    ```bash
    # Installs the latest compatible version (v20.0.0 or higher)
    nvm install 20 
    # Switches to use version 20 for your terminal session
    nvm use 20
    ```

### 1.2. Database Authentication (Google Cloud CLI)

The **Google Cloud CLI (`gcloud`)** is required to securely link your local machine to the Google Cloud project and establish Application Default Credentials (ADC).

1.  **Download and install the Google Cloud CLI** for your operating system.
2.  **Authenticate Credentials:** Open a local terminal in your project directory and run:
    ```bash
    gcloud auth application-default login
    ```
    *(This command opens a browser window where you must sign in with a Google Account that has Owner or Editor permissions for the Firebase project.)*
3.  **Set Project ID (Recommended):** To ensure the CLI targets the correct project, run:
    ```bash
    gcloud config set project liquid-fulcrum-476414-v6
    ```
4.  **Restart VS Code:** Close and reopen VS Code to ensure the terminal picks up the new authentication credentials.

-----

## 2. Installation (Local Dependencies)

  - To ensure all necessary dependencies are available, use the Node Package Manager (`npm`).
  - Note: You only need to run this command once to install the `express` module and create the required `node_modules` directory.

<!-- end list -->

```bash
npm install express
```

  - If your project has a `package.json` file, you can simply run `npm install`.

-----

## 3. Run the Application

This application requires **four separate server processes** to be running simultaneously.

### 3.1. Start the Main Application Server

Start the primary server that serves the static HTML/JS files (typically listens on port 8080).

```bash
node server.js
```

### 3.2. Start the Backend API Server

Start the dedicated API server that handles data and Firestore communication (typically listens on port 5080).

```bash
cd backend
npm start
```

### 3.3. Start Real-Time Servers

Open two additional terminal windows and start the real-time WebSocket servers for the application's interactive features.

| Feature | Directory | Command |
| :--- | :--- | :--- |
| **Flashcards** | `realtime/flashcards` | `node flashcard-server.js` |
| **Whiteboard** | `realtime/whiteboard/src` | `node whiteboard_server.js` |

**Command Line Instructions:**

1.  **Flashcard Real-time Server:**
    ```bash
    cd realtime/flashcards
    node flashcard-server.js
    ```
2.  **Whiteboard Real-time Server:**
    ```bash
    cd realtime/whiteboard/src
    node whiteboard_server.js
    ```

<!-- end list -->

  - Once all four servers are started, you will typically see messages in their respective consoles indicating the ports they are listening on. You can then access the application in your web browser.
  - For a full list of dependencies, please refer to the `package.json` file.