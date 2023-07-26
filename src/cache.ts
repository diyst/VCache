import lmdb from 'node-lmdb'
import { Buffer } from 'buffer';
import { rmSync, readdirSync, mkdirSync } from 'fs';
import path, { resolve } from 'path';

let data: any = {}
let keysWithTime = new Set<string>();

export enum CacheTypes {
  small = "small",
  large = "large"
}

enum StorageTypes {
  variable = "variable",
  lmdb = "lmdb"
};

const env = new lmdb.Env();

let expirationTimer: NodeJS.Timeout | undefined = undefined;

prepareDbContext();

env.open({
  path: '..\\data',
  mapSize: 2 * 1024 * 1024 * 1024
});

const dbi = env.openDbi({
  name: 'cache-database',
  create: true,
});

export class VCache {
  constructor() {
    startExpirationTimer(300000)
  }

  set(key: string, value: any, cacheType: CacheTypes = CacheTypes.small, time?: number): Promise<boolean> {
    return setItem(key, value, cacheType, time)
  }

  get(key: string): Promise<any> {
    return getItem(key)
  }

  exist(key: string): boolean {
    return itemExists(key)
  }

  delete(key: string): Promise<boolean> {
    return deleteItem(key)
  }

  closeConnection() {
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

function setItem(key: string, value: any, cacheType: CacheTypes, time?: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    switch (cacheType) {
      case CacheTypes.small:
        setItemToSmallCache(key, value, time)
        break;
      case CacheTypes.large:
        setItemToLargeCache(key, value, time)
        break;
      default:
        reject("This type isn't a valid cache type");
    }

    resolve(true);
  })
}

function setItemToSmallCache(key: string, value: any, time?: number) {
  if (time != undefined) {
    data[key] = { value: value, time: time, storageType: StorageTypes.variable }
    keysWithTime.add(key)
  } else {
    data[key] = { value: value, storageType: StorageTypes.variable }
  }
}

function setItemToLargeCache(key: string, value: any, time?: number) {

  const txn = env.beginTxn();

  try {
    if (time != undefined) {
      txn.putBinary(dbi, key, Buffer.from(JSON.stringify(value)));
      keysWithTime.add(key);

      data[key] = {
        value: async () => {
          const txn = env.beginTxn();
          let value = txn.getBinary(dbi, key);
          txn.commit();
          return value;
        },
        type: StorageTypes.lmdb,
        time: time
      };
    } else {
      txn.putBinary(dbi, key, Buffer.from(JSON.stringify({ value: value, type: StorageTypes.lmdb })));

      data[key] = {
        value: async () => {
          const txn = env.beginTxn();
          let value = txn.getBinary(dbi, key);
          txn.commit();
          return value;
        }, type: StorageTypes.lmdb
      };

    }
    txn.commit();
  } catch {
    txn.abort();
    throw `Fail to add item ${key}.`
  }
}

function startExpirationTimer(interval: number) {
  expirationTimer = setInterval(() => { validateTimeProperties() }, interval)
}

async function getItem(key: string): Promise<any> {
  return new Promise(async (resolve, reject) => {

    let item = data[key]

    if (Object.keys(item).includes("time")) {
      if (!(await validateTime(item.time, key))) resolve(undefined)
    }

    if (item.type === StorageTypes.lmdb) {
      resolve(JSON.parse(item.value().toString()));
    } else {
      resolve(item.value)
    }
  })
}

async function validateTime(time: number, key: string) {
  const currentTimestamp = Date.now();

  if (currentTimestamp > time) {
    if (await deleteItem(key)) return false;
  }

  return true;
}

function deleteItem(key: string): Promise<boolean> {
  return new Promise((resolve,reject) => {

    let item = data[key]
    
    if (item != undefined) {
      if (item.storageType == StorageTypes.lmdb) {
        const txn = env.beginTxn();
        try {
          txn.del(dbi, key);
        txn.commit();
      } catch {
        txn.abort();
        reject(`Fail to delete item ${key}`)
      }
    }
    
    delete data[key]
    keysWithTime.delete(key)
    resolve(true);
  }
  
  reject("Item don't exist.");
})
}

function itemExists(key: string) {
  return data[key] != undefined
}

function prepareDbContext() {
  const dataPath = path.join(__dirname, "data")

  if (readdirSync(__dirname).includes("data")) {
    if (readdirSync(dataPath).length > 0) {
      rmSync(dataPath, { force: true, recursive: true });
    }
  }

  mkdirSync(dataPath);
}