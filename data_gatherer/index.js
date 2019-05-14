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
const vaultOverride = {
  // This allows me to override the vaulted state of certain primes and relics.
  // This is necessary because WFCD occasionally has bad data.
  'primes': {
  },
  'relics': {
    'Lith O2': false,
    'Meso O3': false,
    'Neo V8': false,
    'Axi L4': false,
  }
}
const relicListOverride = {
  // This allows me to override the list of relics from which the component
  // can drop. Rarity is included so the relic builder can use this too.
  // Frickin Kavasa Prime Collar is the reason again.
  'Kavasa Prime Collar Band': ['uncommon',[
    'Lith C1', 'Lith N2', 'Lith S2', 'Lith S6', 'Meso V3']],
  'Kavasa Prime Collar Buckle': ['rare',[
    'Lith K1', 'Neo S6', 'Axi B1', 'Axi K1']],
  'Kavasa Prime Collar Blueprint': ['uncommon',[
    'Lith S4', 'Neo N1', 'Axi G1']],
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

    // Resolve all promises to finish initial processing.
    Promise.all(promises)
    .then(result => {
      console.log("Finished data population");
      // Now that the initial processing is complete, populate prime vaulted
      // status from relic vaulted status. This is necessary because
      // "unvaulted" primes still show as vaulted, and also because WFCD's
      // data on prime vaulted status is occasionally incorrect, but relic
      // vaulted status is usually correct.
      return correctPrimeVaultedStatus(db, counter);
    })
    .then(result => {
      console.log("Finished vault status correction");
      // Prime/relic data is committed. Update last_updated for each.
      return updateLastUpdated(db, counter);
    })
    .then(result => {
      console.log("Finished last updated");
      // Finally, we can close our Mongo connection and output stats.
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

function isPrimePartData(primeName, data) {
  return (
    // We're only interested in drops which can be traded for ducats, as
    // non-prime-part components will not have that quality.
    "ducats" in data
    // Except for the Kavasa collar, for some bizarre reason.
    || primeName === "Kavasa Prime Kubrow Collar"
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
    if (isPrimePartData(newData.name, dataComponent)) {
      let myComponent = {
        "name": adjustComponentName(newData,dataComponent),
        "needed": dataComponent.itemCount,
        "ducats": dataComponent.ducats,
        "relics": [],
      };
      // Now run through the relics, grab the Intact ones and strip "Intact".
      for (let j in dataComponent.drops) {
        let drop = dataComponent.drops[j];
        if (drop.location.match(/Intact$/)) {
          myComponent.relics.push(drop.location.replace(" Intact",""));
        }
      }
      // If we want to override the relic list, do so.
      if (myComponent.name in relicListOverride) {
        myComponent.relics = relicListOverride[myComponent.name][1];
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
  let vaulted = newData.vaulted;
  if (newData.name in vaultOverride.primes) {
    vaulted = vaultOverride.primes[newData.name];
  }
  return {
    "name": newData.name,
    "vaulted": vaulted,
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
      if (!isPrimePartData(prime.name, component)) {
        continue;
      }
      // Now run through the drops.
      for (let k in component.drops) {
        let drop = component.drops[k];
        // If this relic matches the drop, then we should add this prime
        // component to the relics rewards.
        if (drop.location == relicName) {
          let reward = {
            "name": adjustComponentName(prime,component),
            "rarity": chanceToRarity[drop.chance],
            "ducats": component.ducats,
          };
          rewards.push(reward);
        }
      }
    }
  }

  // Parse the name into its parts.
  const i1 = relicName.indexOf(" ");
  const i2 = relicName.indexOf(" Intact");
  const name = relicName.slice(0,i2);
  const era = relicName.slice(0,i1);
  const code = relicName.slice(i1+1,i2);

  // Run through relic list overrides, as they obviously don't
  // appear in the normal WFCD data.
  for (const componentName in relicListOverride) {
    if (relicListOverride[componentName][1].indexOf(name) !== -1) {
      const reward = {
        "name": componentName,
        "rarity": relicListOverride[componentName][0],
        "ducats": 0,
      };
      rewards.push(reward);
    }
  }

  // Now that we have pre-processing finished, the data is simple to build.
  let vaulted = !("drops" in newData);
  if (name in vaultOverride.relics) {
    vaulted = vaultOverride.relics[name];
  }
  return {
    "name": name,
    "era": era,
    "era_num": eraToNum(era),
    "code": code,
    "code_padded": padCode(code),
    "vaulted": vaulted,
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
  // For primes, copy the vaulted status of the existing data temporarily,
  // so that we don't count changes to it as updates (until later, when we
  // correct vaulted status).
  let vaulted = builtData.vaulted;
  if (collection === primesCollection && !(builtData.name in vaultOverride)) {
    builtData.vaulted = oldData.vaulted;
  };

  if (deepEqual(builtData, oldData)) {
    // They're equal, so just return an empty result.
    return Promise.resolve({});
  } else {
    // Otherwise, update, making sure to set vaulted status back first.
    builtData.vaulted = vaulted;
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
  if (component.name.match(/Prime/) || prime.name.match(/Kavasa Prime/)) {
    // The special case of the Kavasa Prime collar. For some reason,
    // the API returns them as "Kavasa Prime [name]" instead of
    // "Kavasa Prime Collar [name]". We need the latter in order for the
    // interface to look nice.
    if (component.name.match(/Kavasa Prime/)) {
      return component.name.replace(/Kavasa Prime/, "Kavasa Prime Collar");
    } else if (prime.name.match(/Kavasa Prime/)) {
      // The extra special case of the Kavasa Prime collar blueprint.
      return "Kavasa Prime Collar Blueprint";
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
    if (counter.primesInserted > 0 || counter.primesUpdated > 0) {
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
    if (counter.relicsInserted > 0 || counter.relicsUpdated > 0) {
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

/*
 * Fixes vaulted status of primes, based on vaulted status of relics.
 * Note that we may end up double-counting prime updates in the counter,
 * as we have no way of knowing if the non-vault prime data was also updated.
 * TODO: Make a better counter which tracks which primes are updated.
 */
async function correctPrimeVaultedStatus(db, counter) {
  const cursor = db.collection(primesCollection).find({name:{$exists:true}});
  let promises = [];
  let prime;
  while (prime = await cursor.next()) {
    promises.push(correctOnePrimeVaultedStatus(db, counter, prime));
  }
  return Promise.all(promises);
}

async function correctOnePrimeVaultedStatus(db, counter, prime) {
  // Default is unvaulted, only vaulted if any components vaulted.
  let shouldBeVaulted = false;
  for (const component of prime.components) {
    // Default for components is vaulted, only unvaulted if any relic
    // is unvaulted.
    let componentVaulted = true;
    for (const relic of component.relics) {
      await db.collection(relicsCollection).findOne({name: relic})
      .then(result => {
        if (result !== null && !result.vaulted) {
          componentVaulted = false;
        }
      });
      if (!componentVaulted) {
        break;
      }
    }
    if (componentVaulted) {
      shouldBeVaulted = true;
      break;
    }
  }

  // We've determined whether the prime *should* be vaulted. Now check
  // the actual status and update data if necessary.
  if (prime.vaulted !== shouldBeVaulted
      && !(prime.name in vaultOverride)
  ) {
    return db.collection(primesCollection).updateOne(
      {name: prime.name},
      {$set: {vaulted: shouldBeVaulted}}
    )
    .then(result => {
      counter.primesUpdated += 1;
      return true;
    });
  } else {
    return Promise.resolve(false);
  }
}

function eraToNum(era) {
  const eraToNumDict = {
    "Lith": 0,
    "Meso": 1,
    "Neo": 2,
    "Axi": 3,
  };

  return eraToNumDict[era];
}

function padCode(code) {
  const letter = code.slice(0,1);
  const numPart = parseInt(code.slice(1));

  if (numPart < 10) {
    return letter+"0"+numPart;
  } else {
    return code;
  }
}


driver();
