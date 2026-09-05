const { createApp } = require('./app');
const { env } = require('./config/env');

const app = createApp();
app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`API listening on http://0.0.0.0:${env.PORT}`);
});
