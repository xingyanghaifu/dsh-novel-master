const fs = require('fs');
const content = fs.readFileSync('_asar_probe/out/dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-models/lib/client.js', 'utf8');
const pos = content.indexOf('ctx.configForms.describe');
console.log('pos:', pos);
const matches = [...content.matchAll(/configForms[a-zA-Z0-9_\.]*/g)];
console.log('matches:', matches);
