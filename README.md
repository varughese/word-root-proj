# testing-server
A test server that uses node.js and express to create a localhost server that can be used for testing.

Most modern browsers do not allow file requests on non http servers for security purposes. There, using a test server allows for development that allows you to make such requests. 

All relevant app information should be placed within the `app` folder!


### Running

```
npm install nodemon -g
```

Running nodemon will help your workflow! It automatically listens for changes, and refreshes the server as needed.
