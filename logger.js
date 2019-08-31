const { createLogger, format, transports } = require('winston');
  
const logger = createLogger({
    level: 'info',
    format: format.combine(
        format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        format.printf(
          info =>
            `[${info.timestamp}] ${info.level}: ${info.message}`
        ),
    ),
    defaultMeta: { service: 'WeiboMonitor' },
    transports: [
      new transports.File({ filename: __dirname + '/../pocket48-monitor.error.log', level: 'error' }),
      new transports.File({ filename: __dirname + '/../pocket48-monitor.all.log' }),
      new transports.Console(),
    ]
});

module.exports = logger;