import lmdb from 'node-lmdb'
import { Buffer } from 'buffer';


let data = {}
let keysWithTime = new Set();

const cacheTypes = {
    small: "small",
    large: "large"
}

const storageTypes = {
    variable: "variable",
    lmdb: "large"
}

const env = new lmdb.Env();

let expirationTimer = null;

env.open({
    path: '..\\data',
    mapSize: 2*1024*1024*1024
});

const dbi = env.openDbi({
    name: 'cache-database',
    create: true,
});

export class VCache {
    constructor() {
        startExpirationTimer(300000)
    }

    set(key, value, cacheType, time) {
        return setItem(key, value, cacheType, time)
    }

    get(key) {
        return getItem(key)
    }

    exist(key) {
        return itemExists(key)
    }

    delete(key) {
        return deleteItem(key)
    }

    closeConnection(){
        clearInterval(expirationTimer)
        env.close();
    }
}

function validateTimeProperties() {
    const currentTimestamp = Date.now();

    for (const key of keysWithTime) {
        const item = data[key];

        if (currentTimestamp > item.time) {
            delete data[key];
            keysWithTime.delete(key);
        }
    }
}

function setItem(key, value, cacheType, time) {
    if (cacheType === cacheTypes.small) {
        setItemToSmallCache(key, value, time)
    } else if (cacheType === cacheTypes.large) {
        setItemToLargeCache(key, value, time)
    } else {
        throw "This type isn't a valid cache type"
    }
    return true;
}

function setItemToSmallCache(key, value, time) {
    if (time != undefined) {
        data[key] = { value: value, time: time, storageType: storageTypes.variable }
        keysWithTime.add(key)
    } else {
        data[key] = { value: value, storageType: storageTypes.variable }
    }
}

function setItemToLargeCache(key, value, time) {

    const txn = env.beginTxn();

    try {
        if (time != undefined) {
            txn.putBinary(dbi, key, Buffer.from(JSON.stringify({ value: value, time: time, type: storageTypes.lmdb })));
            keysWithTime.add(key);
            data[key] = {
                value: (txn) => {
                    return txn.getBinary(dbi, key)
                }, type: storageTypes.lmdb, time: time
            };
        } else {
            txn.putBinary(dbi, key, Buffer.from(JSON.stringify({ value: value, type: storageTypes.lmdb })));
            data[key] = {
                value: () => {
                    const txn = env.beginTxn();
                    let value = txn.getBinary(dbi, key)
                    txn.commit();
                    return value;
                }, type: storageTypes.lmdb
            };
        }
        txn.commit();
    } catch (ex) {
        console.log(ex)
        txn.abort();
        throw `Fail to add item ${key}.`
    }
}

function startExpirationTimer(interval) {
    expirationTimer = setInterval(() => { validateTimeProperties() }, interval)
}

function getItem(key) {
    let item = data[key]

    if (Object.keys(item).includes("time")) {
        validateTime(item.time, key)
    }

    if (item.type === storageTypes.lmdb) {
        return JSON.parse(item.value().toString());
    } else {
        return item.value
    }
}

function validateTime(time, key) {
    const currentTimestamp = Date.now();

    if (currentTimestamp > time) {
        deleteItem(key)
        return false;
    }

    return true;
}

function deleteItem(key) {
    let item = data[key]

    if (item != undefined) {
        if (item.storageType == storageTypes.lmdb) {
            const txn = env.beginTxn();
            try {
                txn.del(dbi, key);
                txn.commit();
            } catch {
                txn.abort();
                throw `Fail to delete item ${key}`
            }
        }

        delete data[key]
        keysWithTime.delete(key)
        return true;
    }

    return false;
}

function itemExists(key) {
    return data[key] != undefined
}