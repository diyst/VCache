import lmdb from 'node-lmdb'

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
env.open({
    path: '../data/',
});

const txn = env.beginTxn();
const dbi = txn.openDbi({
    name: 'cache-database',
    create: true
});

export class VCache {
    constructor() {
        startExpirationTimer(300000)
    }

    set(key, value, cacheType, time) {
        setItem(key, value, cacheType, time)
    }

    get(key) {
        getItem(key)
    }

    exist(key) {
        itemExists(key)
    }

    delete(key) {
        deleteItem(key)
    }
}

async function validateTimeProperties() {
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
    try {
        if (time != undefined) {
            txn.putBinary(dbi, key, { value: value, time: time, storageType: storageTypes.lmdb });
            keysWithTime.add(key);

        } else {
            txn.putBinary(dbi, key, { value: value, storageType: storageTypes.lmdb });
        }

        data[key] = () => txn.getBinary(dbi, key);
        txn.commit();
    } catch {
        txn.abort();
        throw `Fail to add item ${key}.`
    }
}

function startExpirationTimer(interval) {
    setInterval(validateTimeProperties(), interval)
}

function getItem(key) {
    let item = data[key]

    if (Object.keys(item).includes("time")) {
        validateTime(item.time, key)
    }

    if (item.type === storageTypes.lmdb) {
        return item.value()
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
            try{
                txn.del(dbi, key);
                txn.commit();
            }catch{
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