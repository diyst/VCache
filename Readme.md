# VCache - In-memory and LMDB Cache

## Overview

VCache is a simple cache library that provides in-memory and LMDB-based caching functionalities for Node.js applications. The cache can store both small and large data with optional expiration times for cached items. The library offers easy-to-use methods for setting, getting, checking existence, and deleting cached items.

## Installation

```bash
npm install VCache
```

## Usage

To begin using VCache, import the library and create an instance of the `VCache` class:

```javascript
import { VCache, CacheTypes } from 'vcache';

const cache = new VCache();
```

### Caching Data

You can cache data using the `set` method:

```javascript
// Cache a small item without expiration time
cache.set('smallItem', 'This is a small cached item.', CacheTypes.small);

// Cache a large item with an expiration time of 1 hour (in milliseconds)
cache.set('largeItem', 'This is a large cached item with expiration.', CacheTypes.large, 3600000);
```

### Retrieving Cached Data

Retrieve cached data using the `get` method:

```javascript
const smallItem = cache.get('smallItem');
const largeItem = cache.get('largeItem');

console.log(smallItem); // Output: 'This is a small cached item.'
console.log(largeItem); // Output: 'This is a large cached item with expiration.'
```

### Checking Existence

You can check if a key exists in the cache using the `exist` method:

```javascript
if (cache.exist('smallItem')) {
  // The key exists in the cache
} else {
  // The key does not exist in the cache
}
```

### Deleting Cached Data

To delete an item from the cache, use the `delete` method:

```javascript
cache.delete('smallItem'); // Deletes the 'smallItem' from the cache, if it exists.
```

### Closing the Connection

When you're done using the cache, make sure to close the connection to release resources:

```javascript
cache.closeConnection();
```

## Conclusion

VCache is a versatile caching library that allows you to store small and large data efficiently in-memory and using LMDB storage. With optional expiration times, it ensures your cached data stays up to date while minimizing memory usage. Use VCache to boost the performance of your Node.js applications by caching frequently accessed data.
