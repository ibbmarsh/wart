"use strict";
// Imports
const MongoClient = require('mongodb').MongoClient;
const Items = require('warframe-items');
const assert = require('assert');
const deepEqual = require('deep-equal');

// MongoDB setup
const url = 'mongodb://wart_mongo_1:27017'
const client = new MongoClient(url);
const dbName = 'wart';
const primesCollection = 'primes';
const relicsCollection = 'relics';

// Constants as helpers
const primeWhitelist = [
  'Kavasa Prime Kubrow Collar',
];
const primeBlacklist = [
  // These are accessories which can only be purchased.
  'Chordalla Prime',
  'Pedestal Prime',
  // Founder items can't be gotten from relics, so I don't want them here.
  'Excalibur Prime',
  'Lato Prime',
  'Skana Prime',
  // The extractors are only available by purchasing vault packs.
  'Titan Extractor Prime',
  'Distilling Extractor Prime',
  // Sentinel weapons are awarded automatically upon acquiring the sentinel.
  'Deconstructor Prime',
  'Sweeper Prime',
  'Prime Laser Rifle',
];
const chanceToRarity = {
  // TODO: find a better way to determine rarity than hardcoding decimals
  0.25329999999999997: 'common', // Fugly, but fine for now
  0.11: 'uncommon',
  0.02: 'rare',
}

function driver() {
  // Set up Mongo connection
  client.connect(function(err) {
    assert.equal(null, err);
    console.log("Connected to Mongo successfully");

    let db = client.db('wart');

    let counter = {
      'primes': 0,
      'primesInserted': 0,
      'primesUpdated': 0,
      'primesErrored': 0,
      'relics': 0,
      'relicsInserted': 0,
      'relicsUpdated': 0,
      'relicsErrored': 0
    }

    // Set up warframe-items data
    let wfcdData = new Items();

    let promises = [];

    // Run through all items, looking for primes and relics
    for (let i in wfcdData) {
      // Don't even bother trying if there's no name to check.
      if (!("name" in wfcdData[i])) {
        continue;
      }

      // Check for primes first
      if (isPrimeData(wfcdData[i])) {
        counter.primes += 1;
        let promise = createOrUpdatePrimeInDB(db, wfcdData[i], counter);
        promises.push(promise);

      // Check for relics next
      } else if (isRelicData(wfcdData[i])) {
        counter.relics += 1;
        // Note that we pass the whole of wfcdData to the relic update function
        // because we need to determine which parts drop from that relic,
        // and for some god-forsaken reason, wfcd only includes that on the
        // parts themselves, instead of the relics.
        let promise = createOrUpdateRelicInDB(
          db, wfcdData[i], counter, wfcdData);
        promises.push(promise);
      }
    }

    // Resolve all promises before closing the connection and outputting stats
    Promise.all(promises)
    .then((result) => {
      // Now that we have resolved all promises, we can check if there have
      // been any updates or inserts. If so, update the special last_updated
      // object with today's datetime.
      updateLastUpdated(db, counter)
      .then((result) => {
        client.close();

        console.log("Inserted/Updated/Errored/File");
        console.log("Primes: "
          +counter.primesInserted+"/"
          +counter.primesUpdated+"/"
          +counter.primesErrored+"/"
          +counter.primes);
        console.log("Relics: "
          +counter.relicsInserted+"/"
          +counter.relicsUpdated+"/"
          +counter.relicsErrored+"/"
          +counter.relics);
      });
    });
  });
}

function isPrimeData(data) {
  return (
    (
      // The name ends in Prime and isn't blacklisted
      data.name.match(/Prime$/)
      && primeBlacklist.indexOf(data.name) == -1
    )
    // Or the name is whitelisted
    || primeWhitelist.indexOf(data.name) != -1
  )
}

function isRelicData(data) {
  return (
    // Only look for Intact relics; we can extrapolate from there
    data.name.match(/Intact$/)
  )
}

function isPrimePartData(data) {
  return (
    // We're only interested in drops which can be traded for ducats, as
    // non-prime-part components will not have that quality.
    "ducats" in data
    // Except for the Kavasa collar, for some bizarre reason.
    || data.name == "Kavasa Prime Band"
    || data.name == "Kavasa Prime Buckle"
  );
}

async function createOrUpdatePrimeInDB(db, newData, counter) {
  let builtData = buildPrimeData(newData);
  let name = builtData.name;

  return db.collection(primesCollection)
         .findOne({"name": name})
         .then((result) => {
           if (result === null) {
             // If we didn't find an existing prime, insert this new prime
             return insertDataInDB(db, primesCollection, builtData);
           } else {
             // If we did find an existing prime, update it with this data
             return updateDataInDB(db, primesCollection, builtData, result);
           }
         })
         .then((result) => {
           // Increment appropriate counter
           if ("insertedCount" in result) {
             counter.primesInserted += 1;
           } else if ("modifiedCount" in result) {
             counter.primesUpdated += 1;
           }
         })
         .catch((err) => {
           console.error("Error encountered while inserting/updating "
             +name+": ");
           console.dir(err);
         });
}

function buildPrimeData(newData) {
  // This builds up our internal mongo data structure.
  // See https://trac.ibbathon.com/trac/wiki/WaRT/Design/Backend for an example

  let components = [];
  let componentNamesAdded = [];
  for (let i in newData.components) {
    let dataComponent = newData.components[i];
    // We only want to know about prime parts.
    if (isPrimePartData(dataComponent)) {
      let myComponent = {
        "uid": dataComponent.uniqueName,
        "name": adjustComponentName(newData,dataComponent),
        "needed": dataComponent.itemCount,
        "relics": [],
      };
      // Now run through the relics, grab the Intact ones and strip "Intact".
      for (let j in dataComponent.drops) {
        let drop = dataComponent.drops[j];
        if (drop.location.match(/Intact$/)) {
          myComponent.relics.push(drop.location.replace(" Intact",""));
        }
      }
      // We've built our version of the component, push it.
      components.push(myComponent);
    }
  }

  // The special case of the Kavasa Prime collar.
  // The name from the data is "Kavasa Prime Kubrow Collar",
  // but we want the simpler "Kavasa Prime Collar" (which matches wiki).
  if (newData.name === "Kavasa Prime Kubrow Collar") {
    newData.name = "Kavasa Prime Collar";
  }

  // Now that the annoyance of components is dealt with, the actual
  // data is fairly easy to build.
  return {
    "name": newData.name,
    "uid": newData.uniqueName,
    "vaulted": newData.vaulted,
    "components": components,
  };
}

async function createOrUpdateRelicInDB(db, newData, counter, wfcdData) {
  let builtData = buildRelicData(newData, wfcdData);
  let name = builtData.name;

  return db.collection(relicsCollection)
         .findOne({"name": name})
         .then((result) => {
           if (result === null) {
             // If we didn't find an existing relic, insert this new relic
             return insertDataInDB(db, relicsCollection, builtData);
           } else {
             // If we did find an existing relic, update it with this data
             return updateDataInDB(db, relicsCollection, builtData, result);
           }
         })
         .then((result) => {
           // Increment appropriate counter
           if ("insertedCount" in result) {
             counter.relicsInserted += 1;
           } else if ("modifiedCount" in result) {
             counter.relicsUpdated += 1;
           }
         })
         .catch((err) => {
           console.error("Error encountered while inserting/updating "
             +name+": ");
           console.dir(err);
         });
}

function buildRelicData(newData, wfcdData) {
  // This builds up our internal mongo data structure.
  // See https://trac.ibbathon.com/trac/wiki/WaRT/Design/Backend for an example

  // Build the rewards list from the full wfcdData first.
  let relicName = newData.name;
  let rewards = [];
  for (let i in wfcdData) {
    // Don't even bother trying if there's no name to check,
    // or it's not a prime.
    if (!("name" in wfcdData[i] && isPrimeData(wfcdData[i]))) {
      continue;
    }
    let prime = wfcdData[i];
    // Now run through all components and determine if any of them are
    // rewards for this relic.
    for (let j in prime.components) {
      let component = prime.components[j];
      // If it's not a prime part, skip.
      if (!isPrimePartData(component)) {
        continue;
      }
      // Now run through the drops.
      for (let k in component.drops) {
        let drop = component.drops[k];
        // If this relic matches the drop, then we should add this prime
        // component to the relics rewards.
        if (drop.location == relicName) {
          let reward = {
            "uid": component.uniqueName,
            "name": adjustComponentName(prime,component),
            "chance": chanceToRarity[drop.chance],
            "ducats": component.ducats,
          };
          rewards.push(reward);
        }
      }
    }
  }

  // Now that we have pre-processing finished, the data is simple to build.
  let i1 = relicName.indexOf(" ");
  let i2 = relicName.indexOf(" Intact");
  return {
    "name": relicName.slice(0,i2),
    "era": relicName.slice(0,i1),
    "code": relicName.slice(i1+1,i2),
    "vaulted": !("drops" in newData),
    "rewards": rewards,
  };
}

async function insertDataInDB(db, collection, builtData) {
  // Add the timestamp right before inserting
  return db.collection(collection)
         .insertOne(builtData);
}

async function updateDataInDB(db, collection, builtData, oldData) {
  // Use the id of the existing data, so we overwrite it.
  builtData._id = oldData._id;

  if (deepEqual(builtData, oldData)) {
    // They're equal, so just return an empty result.
    return Promise.resolve({});
  } else {
    // Otherwise, update
    return db.collection(collection)
           .updateOne({"name": builtData.name},{$set: builtData});
  }
}

function adjustComponentName(prime, component) {
  // For some reason, the component names in the data just have generic
  // names like "Barrel" instead of "Rubico Prime Barrel". So let's tack
  // the name of the prime on the front.
  // There are only a few exceptions to this issue, and they can be handled
  // by looking for the word Prime in the component name.
  if (component.name.match(/Prime/)) {
    // The special case of the Kavasa Prime collar. For some reason,
    // the API returns them as "Kavasa Prime [name]" instead of
    // "Kavasa Prime Collar [name]". We need the latter in order for the
    // interface to look nice.
    if (component.name.match(/Kavasa Prime/)) {
      return component.name.replace(/Kavasa Prime/, "Kavasa Prime Collar");
    }

    return component.name;
  } else {
    return prime.name+" "+component.name;
  }
}

async function updateLastUpdated(db, counter) {
  // Use the same last_updated time for both primes and relics.
  let updateTime = new Date();

  return Promise.resolve(true)
  .then((result) => {
    if (counter.primesInserted > 0 || counter.primesUpdated) {
      return db.collection(primesCollection)
             .updateOne(
               {'last_updated': {$exists: true}},
               {$set: {'last_updated': updateTime}},
               {upsert: true}
             )
    } else {
      return Promise.resolve(true)
    }
  })
  .then((result) => {
    if (counter.relicsInserted > 0 || counter.relicsUpdated) {
      return db.collection(relicsCollection)
             .updateOne(
               {'last_updated': {$exists: true}},
               {$set: {'last_updated': updateTime}},
               {upsert: true}
             )
    } else {
      return Promise.resolve(true)
    }
  });
}


driver();
