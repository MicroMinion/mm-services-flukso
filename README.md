# mm-services-flukso

[Flukso](http://www.flukso.net) Service for [MicroMinion platform](https://github.com/MicroMinion/mm-platform)

[![CircleCI](https://circleci.com/gh/MicroMinion/mm-services-flukso.svg?style=svg)](https://circleci.com/gh/MicroMinion/mm-services-flukso)

## Initialization

```js
var MicroMinionPlatform = require('mm-platform')
var Flukso = require('mm-services-flukso')

var platform = new MicroMinionPlatform()

var flukso = new Flukso({
  platform: platform,
  logger: platform._log
})
```

## Messaging API

### Published messages

#### flukso.sensor.<sensor-name>

Publishes sensor values.

```js
platform.messaging.on('self.flukso.*', function(topic, sender, data) {
  console.log(data.value)
  console.log(data.unit)
  console.log(data.sensor)
})
```
