// @ts-check
import { Server } from 'socket.io';
import { existsSync, readFileSync } from 'fs';
import { createLogger, format, transports } from 'winston';
import { key, cert } from './config.mjs';
import 'winston-daily-rotate-file';
import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';

const server = (() => {
    if (existsSync(key)) {
        createServer
        return createHttpsServer({
            key: readFileSync(key),
            cert: readFileSync(cert)
        });
    } else {
        return createHttpServer();
    }
})();

const io = new Server(server, {
    allowEIO3: true,
});

const transport = new (transports.DailyRotateFile)({
    filename: '%DATE%.log',
    dirname: 'logs/'
});

const logger = createLogger({
    format: format.simple(),
    transports: [transport]
});

function getTime() {
    const date = new Date();
    const isoString = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    return "["+ isoString + "] ";
}

server.listen(5050, () => {
    logger.info(getTime()+'Starting server on port 5050');
});

/**
 * @param {string} name
 * @param {Module} module
 */
function useModule (name, module) {
    module(io, name, (msg) => {
        logger.info(`${ name } ${ getTime() }: ${ msg }`)
    });
}

import { wuziqi } from './lib/wuziqi.mjs';
import { pencil } from './lib/pencil.mjs';
import { zhanqi1 } from './lib/zhanqi1.mjs';
import { MTWar } from './lib/MTWar.mjs';
import { createServer } from 'http';

useModule('wuziqi', wuziqi);
useModule('pencil', pencil);
useModule('zhanqi1', zhanqi1);
useModule('MTWar', MTWar);
