"use strict";
// Imports
const MongoClient = require('mongodb').MongoClient;
const assert = require('assert');
const deepEqual = require('deep-equal');
const request = require('request');
const parse = require('node-html-parser').parse;

// Official drop tables
const dropTablesURL = 'https://n8k6e2y6.ssl.hwcdn.net/repos/hnfvc0o3jnfvc873njb03enrf56.html';

// MongoDB setup
const url = 'mongodb://wart_mongo_1:27017';
const client = new MongoClient(url, {useNewUrlParser: true});
const dbName = 'wart';
const primesCollection = 'primes';
const relicsCollection = 'relics';

// Dict to keep track of which primes/relics were inserted/updated/etc.
// Keys are prime/relic name
// Values are inserted/updated/errored/unchanged
// e.g. primesFound['Frost Prime'] = 'unchanged'
let primesFound = {};
let relicsFound = {}

/**
 * Main driver for data_gatherer.
 * Opens Mongo connection, grabs and parses text from official drops page,
 * and calls all the methods to gather data from that text into the DB.
 * Finally outputs stats.
 */
function driver() {
  // Set up Mongo connection
  client.connect(function(err) {
    assert.equal(null, err);
    console.log("Connected to Mongo successfully");

    let db = client.db('wart');

    // Gather drop table data
    downloadPage(dropTablesURL)
    .then(result => {
      const parsedHTML = parse(result);
      const bodyChildren = parsedHTML.childNodes[0].childNodes[1].childNodes;

      // Find the relic rewards tables
      let relicTable;
      for (const i in bodyChildren) {
        if (bodyChildren[i].id === 'relicRewards') {
          relicTable = bodyChildren[parseInt(i)+1].childNodes;
          break;
        }
      }

      // Next, we're going to find the mission drops tables
      let missionTable;
      for (const i in bodyChildren) {
        if (bodyChildren[i].id === 'missionRewards') {
          missionTable = bodyChildren[parseInt(i)+1].childNodes;
          break;
        }
      }

      console.log("Gathered tables from official data");

      // Use both tables to create the objects and put them in the DB
      const promises = gatherDataFromOfficialTables(
        db, relicTable, missionTable);

      // Next in the .then chain should wait for all prime/relic processing
      return Promise.all(promises);
    })
    .then(results => {
      console.log("Finished updating primes/relics");
      // Update last_updated for prime/relic collections
      return updateLastUpdated(db);
    })
    .then(results => {
      // No more Mongo work is needed
      client.close();

      // Calculate and output stats
      let counter = {
        primesTotal: 0,
        primesInserted: 0,
        primesUpdated: 0,
        primesErrored: 0,
        relicsTotal: 0,
        relicsInserted: 0,
        relicsUpdated: 0,
        relicsErrored: 0,
      };
      for (const prime in primesFound) {
        counter.primesTotal += 1;
        if (primesFound[prime] === 'inserted') {
          counter.primesInserted += 1;
        } else if (primesFound[prime] === 'updated') {
          counter.primesUpdated += 1;
        } else if (primesFound[prime] === 'errored') {
          counter.primesErrored += 1;
        }
      }
      for (const relic in relicsFound) {
        counter.relicsTotal += 1;
        if (relicsFound[relic] === 'inserted') {
          counter.relicsInserted += 1;
        } else if (relicsFound[relic] === 'updated') {
          counter.relicsUpdated += 1;
        } else if (relicsFound[relic] === 'errored') {
          counter.relicsErrored += 1;
        }
      }
      console.log("Inserted/Updated/Errored/Total");
      console.log("Primes: "
        +counter.primesInserted+"/"
        +counter.primesUpdated+"/"
        +counter.primesErrored+"/"
        +counter.primesTotal);
      console.log("Relics: "
        +counter.relicsInserted+"/"
        +counter.relicsUpdated+"/"
        +counter.relicsErrored+"/"
        +counter.relicsTotal);
    })
    .catch(error => {
      console.log(error);
      client.close();
    });
  });
}

/**
 * Helper get function to make it easier to write in promise style
 * Code from:
 * https://stackoverflow.com/questions/8775262/synchronous-requests-in-node-js
 */
function downloadPage(url) {
  return new Promise((resolve, reject) => {
    request(url, (error, response, body) => {
      if (error) reject(error);
      if (response.statusCode != 200) {
        reject('Invalid status code <' + response.statusCode + '>');
      }
      resolve(body);
    });
  });
}

/**
 * Processes the relic tables from the official drop tables and
 * inserts/updates the primes and relics found within.
 * Uses information from the mission tables to determine vault status for
 * each relic/part.
 */
function gatherDataFromOfficialTables(db, relicTable, missionTable) {
  const unvaultedRelics = missionTableToRelicList(missionTable);
  const [relics, primes] = relicTableToLists(relicTable, unvaultedRelics);
  let promises = [];

  for (const relic of relics) {
    promises.push(createOrUpdateObjectInDB(
      db.collection(relicsCollection),
      relicsFound,
      relic,
      copyRelicData
    ));
  }
  for (const prime of primes) {
    promises.push(createOrUpdateObjectInDB(
      db.collection(primesCollection),
      primesFound,
      prime,
      copyPrimeData
    ));
  }

  return promises;
}

/**
 * Converts the raw HTML from the missionRewards section to a list of
 * any relics which appear in said HTML (i.e. unvaulted relics).
 */
function missionTableToRelicList(missionTable) {
  let unvaultedRelics = [];
  for (const row of missionTable) {
    if (row.childNodes[0].text.match(/Relic/)) {
      const relicName = row.childNodes[0].text
                        .match(/(Lith|Meso|Neo|Axi) \w*/)[0]
      if (unvaultedRelics.indexOf(relicName) !== -1) {
        unvaultedRelics.push(relicName);
      }
    }
  }

  return unvaultedRelics;
}

/**
 * Converts the raw HTML from a list of tables of prime part drops from
 * each relic into two lists: one of primes with given components, and another
 * of relics with their drops.
 *
 * Each relic in the list will look like the following:
 * {
 *   name: "Lith C4",
 *   era: "Lith",
 *   era_num: 0,
 *   code: "C4",
 *   code_padded: "C04",
 *   vaulted: true,
 *   rewards: [
 *     {name: "Braton Prime Stock", rarity: "Uncommon", ducats: 45},
 *     etc.
 *   ]
 * }
 *
 * Each prime in the list will look like the following:
 * {
 *   name: "Frost Prime",
 *   vaulted: true,
 *   components: [
 *     {
 *       name: "Frost Prime Blueprint",
 *       needed: 1,
 *       ducats: 15,
 *       relics: ["Meso F2", "Meso F3", "Neo F1"]
 *     },
 *     etc.
 *   ]
 * }
 *
 * @param relicTable the trs in the relicRewards section of the drop tables
 * @param unvaultedRelics an array of unvaulted relic names
 */
function relicTableToLists(relicTable, unvaultedRelics) {
  let primes = {};
  let relics = [];

  // First, create the list of relics, and use a dict to track the primes,
  // so that we can make use of dict lookup speed (instead of manually finding
  // the prime each time in a list).
  // Note that we increment by 8 because each relic's drop table occupies
  // 8 rows in the overall table (including blank row between tables).
  for (let i = 0; i < relicTable.length; i+=8) {
    // First row is the header with the relic name and rarity
    const header = relicTable[i].childNodes[0].text;
    // We only want intact, so skip if it's not
    if (!header.match(/(Intact)/)) {
      continue;
    }

    let relic = {};
    relic.name = header.replace(/ Relic \(Intact\)/,'');
    relic.vaulted = unvaultedRelics.indexOf(relic.name) === -1;
    relic.rewards = [];
    // The next 6 rows are the components dropped from the relic, and rarities
    for (let j = 1; j <= 6; j++) {
      let partName = relicTable[i+j].childNodes[0].text;
      // Skip if Forma
      if (partName === 'Forma' || partName === 'Forma Blueprint') {
        continue;
      }
      // Simplify the partname for the kubrow collar
      if (partName === 'Kavasa Prime Kubrow Collar Blueprint') {
        partName = 'Kavasa Prime Blueprint';
      }

      // Add the part to the rewards list for this relic
      const chance = relicTable[i+j].childNodes[1].text
                     .replace(/.*\((.*)\%\)/,'$1');
      const rarity = chanceToRarity(chance);
      const ducats = rarityToNormalDucats(rarity);
      relic.rewards.push({
        name: partName,
        rarity: rarity,
        ducats: ducats,
      });

      // Add the part to the appropriate prime
      const primeName = partToPrimeName(partName);
      // Create the prime's dict if it doesn't exist
      if (!(primeName in primes)) {
        primes[primeName] = {
          name: primeName,
          vaulted: relic.vaulted,
          components: {},
        };
      }
      // Create the part's dict if it doesn't exist
      if (!(partName in primes[primeName].components)) {
        primes[primeName].components[partName] = {
          name: partName,
          needed: 1,
          ducats: ducats,
          relics: [],
        }
      }
      // Update vaulted based on the relic's status
      if (!relic.vaulted) {
        primes[primeName].vaulted = false;
      }
      // Finally, add this relic as one of the drop sources for the prime
      primes[primeName].components[partName].relics.push(relic.name);
    }

    // The basic relic information is ready. Add helper attributes
    // (era, code, etc.) before adding it to the list.
    relics.push(processRelicName(relic));
  }

  // Now go back through the primes/components and reprocess them into lists
  primes = Object.values(primes);
  for (let prime of primes) {
    prime.components = Object.values(prime.components);
  }

  return [relics,primes];
}

/**
 * Determines if object already exists in DB.
 * If it doesn't, just insert the object.
 * Otherwise, update the object using the provided function, and then update
 * the DB's object.
 * @param collection the Mongo collection (primes/relics)
 * @param counter the dict for primes/relics statuses
 * @param builtObject the data built from the official drop tables
 * @param copyFunction a function to update the builtObject with data from
 *                     the database's object
 * @return a promise for the DB operation
 */
function createOrUpdateObjectInDB(
  collection, counter, builtObject, copyFunction
) {
  const name = builtObject.name;

  return collection
         .findOne({'name': name})
         .then(result => {
           if (result !== null) {
             // If we did find an existing prime/relic, copy some data from
             // the DB version to our built object
             const dataChanged = copyFunction(result, builtObject);
             // If some data has changed, prime/relic will be updated
             if (dataChanged) {
               counter[name] = 'updated';
             } else {
               // Otherwise, don't even try to update DB
               counter[name] = 'unchanged';
               return Promise.resolve('unchanged');
             }
           } else {
             // If we didn't find an existing prime/relic, this is an insert
             counter[name] = 'inserted';
           }
           // Then put our new data in the DB
           return upsertDataInDB(collection, builtObject);
         })
         .catch((err) => {
           console.error('Error encountered while inserting/updating '
             +name+': ');
           console.dir(err);
           counter[name] = 'errored';
         });
}

/**
 * Performs the actual insert/update into the Mongo DB collection.
 */
function upsertDataInDB(collection, builtObject) {
  return collection.updateOne(
    {'name': builtObject.name},
    {$set: builtObject},
    {upsert: true}
  );
}

/**
 * Copies ducat values and needed count from the old Mongo object to the
 * new built one.
 * @param mongoObject the old data in the DB
 * @param builtObject the new data to be put in the DB
 * @return true if vaulted or drop sources have changed, false otherwise
 */
function copyPrimeData(mongoObject, builtObject) {
  let dataChanged = false;

  // Checking vaulted is easy, so do that first
  if (mongoObject.vaulted !== builtObject.vaulted) {
    dataChanged = true;
  }

  // Everything else is in the components, so do those next
  for (const builtComponent of builtObject.components) {
    // Find the corresponding component in Mongo
    let mongoComponent;
    for (const component of mongoObject.components) {
      if (builtComponent.name === component.name) {
        mongoComponent = component;
        break;
      }
    }
    // If we didn't find a corresponding component, then data changed
    // We will hopefully never get this case, but it doesn't hurt to be safe
    if (mongoComponent === undefined) {
      dataChanged = true;
      continue;
    }

    // Compare the drop lists to see if they changed
    mongoComponent.relics.sort();
    builtComponent.relics.sort();
    if (mongoComponent.relics.toString() !== builtComponent.relics.toString()) {
      dataChanged = true;
    }

    // Finally, copy over the ducats and needed count, as those are not
    // available in the official data, and so may be wrong
    builtComponent.ducats = mongoComponent.ducats;
    builtComponent.needed = mongoComponent.needed;
  }

  return dataChanged;
}

/**
 * Copies ducat values from the old Mongo object to the new built one.
 * @param mongoObject the old data in the DB
 * @param builtObject the new data to be put in the DB
 * @return true if vaulted has changed, false otherwise
 */
function copyRelicData(mongoObject, builtObject) {
  let dataChanged = false;

  // Checking vaulted is easy, so do that first
  if (mongoObject.vaulted !== builtObject.vaulted) {
    dataChanged = true;
  }

  // Everything else is in the rewards, so do those next
  for (const builtReward of builtObject.rewards) {
    // Find the corresponding reward in Mongo
    let mongoReward;
    for (const reward of mongoObject.rewards) {
      if (builtReward.name === reward.name) {
        mongoReward = reward;
        break;
      }
    }
    // If we didn't find a corresponding reward, then data changed
    // We will hopefully never get this case, but it doesn't hurt to be safe
    if (mongoReward === undefined) {
      dataChanged = true;
      continue;
    }

    // Finally, copy over the ducats, as those are not
    // available in the official data, and so may be wrong
    builtReward.ducats = mongoReward.ducats;
  }

  return dataChanged;
}

/**
 * Updates the last_updated document for the primes and relics collections.
 * TODO: It currently does this regardless of whether any primes/relics have
 *       actually been updated. Change it so it only does so if so.
 */
function updateLastUpdated(db) {
  // Use the same last_updated time for both primes and relics.
  let updateTime = new Date();

  return [
    db.collection(primesCollection)
      .updateOne(
        {'last_updated': {$exists: true}},
        {$set: {'last_updated': updateTime}},
        {upsert: true}
      ),
    db.collection(relicsCollection)
      .updateOne(
        {'last_updated': {$exists: true}},
        {$set: {'last_updated': updateTime}},
        {upsert: true}
      )
  ]
}


/********************
 * Helper functions *
 ********************/

function eraToNum(era) {
  const eraToNumDict = {
    "Lith": 0,
    "Meso": 1,
    "Neo": 2,
    "Axi": 3,
  };

  return eraToNumDict[era];
}

function chanceToRarity(chance) {
  const chanceToRarityDict = {
    '25.33': 'common',
    '11.00': 'uncommon',
    '2.00': 'rare',
  };

  return chanceToRarityDict[chance];
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

/**
 * Returns the "x Prime" part of a prime part's name.
 */
function partToPrimeName(partName) {
  return partName.match(/^.* Prime/)[0];
}

/**
 * Processes the "Lith G1" relic name into its component parts:
 * era: "Lith"
 * era_num: 0
 * code: "G1"
 * code_padded: "G01"
 * @param relic the full relic dict
 * @return the same relic dict with the new attributes added
 */
function processRelicName(relic) {
  // Parse the name into its parts
  const era = relic.name.match(/.* /)[0].trim();
  const code = relic.name.match(/ .*/)[0].trim();
  // Add the attributes
  relic.era = era;
  relic.era_num = eraToNum(era);
  relic.code = code;
  relic.code_padded = padCode(code);
  // And send it back
  return relic;
}

/**
 * Returns the number of ducats normally expected for that rarity.
 */
function rarityToNormalDucats(rarity) {
  const rarityToNormalDucatsDict = {
    common: 15,
    uncommon: 45,
    rare: 100,
  };

  return rarityToNormalDucatsDict[rarity]
}


/*******************
 * Kick off driver *
 *******************/
driver();
