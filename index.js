'use strict'

var mqtt = require('mqtt')
var mdns = require('mdns-js')
var _ = require('lodash')
var assert = require('assert')

var Flukso = function (options) {
  assert(_.isObject(options))
  assert(_.isObject(options.platform))
  this.platform = options.platform
  assert(_.isObject(options.logger))
  this._log = options.logger
  this.browser = mdns.createBrowser(mdns.tcp('mqtt'))
  this.sensors = {}
  var flukso = this
  this.browser.on('ready', function () {
    flukso.browser.discover()
  })
  this.browser.on('update', function (data) {
    var address = data.addresses[0]
    var port = data.port
    flukso.createClient(address, port)
  })
}

Flukso.prototype.createClient = function (address, port) {
  var self = this
  var mqttclient = mqtt.connect({
    host: address,
    port: port
  })
  mqttclient.on('connect', function () {
    mqttclient.subscribe('/device/+/config/sensor')
    mqttclient.subscribe('/sensor/#')
  })
  mqttclient.on('error', function () {
    self._log.info('mqtt client raised an error')
  })
  mqttclient.on('message', this.processMessage.bind(this))
}

Flukso.prototype.processMessage = function (topic, message) {
  var topicArray = topic.split('/')
  var payload = message.toString()
  try {
    payload = JSON.parse(payload)
  } catch (e) {
    return
  }
  switch (topicArray[1]) {
    case 'device':
      this.handleDevice(topicArray, payload)
      break
    case 'sensor':
      this.handleSensor(topicArray, payload)
      break
    default:
      break
  }
}

Flukso.prototype.handleDevice = function (topicArray, message) {
  if (topicArray[3] === 'config') {
    _.forEach(message, function (value, key) {
      if (_.has(value, 'type') && _.has(value, 'id')) {
        this.sensors[value.id] = value.type
      }
    }, this)
  }
}

Flukso.prototype.handleSensor = function (topicArray, message) {
  var sensor = topicArray[2]
  if (topicArray[3] === 'gauge') {
    this.platform.messaging.send('flukso.sensor.' + this.sensors[sensor], 'local', {
      value: message[1],
      unit: message[2],
      sensor: sensor
    })
  }
}

module.exports = Flukso
