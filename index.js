require('dotenv').load();
var pm2 = require('pm2');
var nodemailer = require('nodemailer');
var createSes = require('nodemailer-ses-transport');
var moment = require('moment-timezone');
var _ = require('lodash');

var mailReceiver = process.env.MAIL_RECEIVER || false;
var mailSender = process.env.MAIL_SENDER;
var sesId = process.env.SES_ID;
var sesSecret = process.env.SES_SECRET;

if (!mailReceiver || !sesId || !sesSecret) {
  throw new Error('sesId || sesSecret || receiver not specified');
}

var transportOptions = {
  accessKeyId: sesId,
  secretAccessKe: sesSecret
};

const transporter = nodemailer.createTransport(createSes(transportOptions));

pm2.connect(function(err) {
  if (err) { throw err; }
  console.log('connected to pm2');
  console.log('setting up exception event listener');

  var compiled = _.template(
    'An error has occurred on server ' +
    '<% name %>\n' +
    'Stack Trace:\n\n\n<%= stack %>\n\n\n' +
    'Context:\n\n<%= text %>'
  );

  pm2.launchBus(function(err, bus) {
    if (err) { throw err; }

    console.log('event bus connected');

    bus.on('process:exception', function(data) {
      var text;
      var stack;
      var name;
      try {
        data.date = moment(data.at || new Date())
          .tz('America/Los_Angeles')
          .format('MMMM Do YYYY, h:mm:ss a z');

        text = JSON.stringify(data, null, 2);
        stack = data.data.stack;
        name = data.process.name;
      } catch (e) {
        console.error('Error parsing exception' + e);
        return e;
      }

      return transporter.sendMail({
        to: mailReceiver,
        from: mailSender,
        subject: 'Server exception',
        text: compiled({ name: name, text: text, stack: stack })
      });
    });
  });
});
