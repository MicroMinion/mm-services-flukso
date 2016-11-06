'use strict'

var mqtt = require('mqtt')
var MulticastDNS = require('multicast-dns')
var _ = require('lodash')
var assert = require('assert')
var winstonWrapper = require('winston-meta-wrapper')

var QUERY_INTERVAL = 1000 * 30

var Flukso = function (options) {
  var self = this
  assert(_.isObject(options))
  assert(_.isObject(options.platform))
  this.platform = options.platform
  assert(_.isObject(options.logger))
  this._log = winstonWrapper(options.logger)
  this._log.addMeta({
    module: 'mm:services:flukso'
  })
  this.sensors = {}
  this._clients = {}
  this.mdns = new MulticastDNS({
    loopback: true
  })
  this.mdns.on('response', function (response) {
    if (_.has(response, 'answers') && _.some(response.answers, function (answer) {
        return answer.name === '_mqtt._tcp.local'
      })) {
      var srvRecord = _.find(response.answers, function (answer) {
        return answer.type === 'SRV'
      })
      var aRecord = _.find(response.answers, function (answer) {
        return answer.type === 'A'
      })
      var port = srvRecord.data.port
      var address = aRecord.data
      self.createClient(address, port)
    }
  })
  this.mdns.query('_mqtt._tcp.local')
  setInterval(function () {
    self.mdns.query('_mqtt._tcp.local')
  }, QUERY_INTERVAL)
}

Flukso.prototype.createClient = function (address, port) {
  var self = this
  var key = address + ':' + port
  if (_.has(this._clients, key)) {
    return
  }
  this._clients[key] = mqtt.connect({
    host: address,
    port: port
  })
  var client = this._clients[key]
  client.on('connect', function () {
    client.subscribe('/device/+/config/sensor')
    client.subscribe('/sensor/#')
  })
  client.on('error', function () {
    self._log.info('mqtt client raised an error')
  })
  client.on('message', this.processMessage.bind(this))
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
  var self = this
  if (topicArray[3] === 'config') {
    _.forEach(message, function (value, key) {
      if (_.has(value, 'type') && _.has(value, 'id')) {
        self.sensors[value.id] = value.type
      }
    })
  }
}

Flukso.prototype.handleSensor = function (topicArray, message) {
  var sensor = topicArray[2]
  if (topicArray[3] === 'gauge') {
    this._log.debug('read sensor value ' + sensor + ' ' + message[1])
    this.platform.messaging.send('flukso.sensor.' + this.sensors[sensor], 'local', {
      value: message[1],
      unit: message[2],
      sensor: sensor
    })
  }
}

module.exports = Flukso
