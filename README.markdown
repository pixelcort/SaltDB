SaltDB
======

SaltDB is an in-memory KV Datastore with incremental chained MapReduce indexes that can be subscribed to.

About
-----

Current Features include:

* Index Chaining (multiple pairs of map and reduce functions)
* Incremental Indexing (a la CouchDB's views)
* Index Dependency Tree (multiple reduce functions can feed off the output of a single map function and vice versa)
* Key Subscriptions (get notified when a transformed key changes)
* Lazy Indexing based on need (transforms are not run until they need to be)

Goals are:

* Persist data to disk
* Support sharding data and indexed data in a distributed hash table
* Performance
* Fault-Tolerance

Non-Goals are:

* Support for range queries
* Support for ad-hoc queries
* Support for any queries at all, other than mere key lookups. Ranged results can be created by means of additional transforms

Use
---

1. Install node.js
2. use saltdb.js
3. ...?
4. Profit!

There are two examples:

* dictionaryVote is a hypothetical set of definitions of words and votes on those definitions. The goal here is to have an output of the top three highest voted definitions given a word.
* averageSubscription is a spinoff of dictionaryVote to show how to subscribe to transformed values. As new votes for an entry come in, if the floored average for that entry changes, the callback will be triggered.

Basically you create a database instance, register some transform instances on it, throw in a bunch of data, get transformed values out of it, and subscribe to notifications when transformed values changed.

License
-------

See LICENSE.txt .

Author
------

Cortland Klein <me@pixelcort.com>
