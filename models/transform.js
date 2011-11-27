// saltdb
// Copyright (c) 2011 Cortland Klein <me@pixelcort.com>

var Transform;

Transform = function(mapOrReduce, transformFunction) {
  if (['map','reduce'].indexOf(mapOrReduce)===-1) throw 'mapOrReduce was not valid';
  this._transformFunction = transformFunction;
  this._mapOrReduce = mapOrReduce;
};

exports.Transform = Transform;