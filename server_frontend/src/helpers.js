/*
 * This file is a bunch of helper methods for sifting through the various
 * state data in this frontend.
 */

function findPrimeAndComponentFromPartName(partName, primes) {
  for (const prime of primes) {
    const component = findItemByName(partName, prime.components);
    if (component) {
      return [prime, component];
    }
  }
  return [null, null];
}

function findItemByName(name, stateArray) {
  for (const v of stateArray) {
    if (v.name === name) {
      return v;
    }
  }
  return null;
}

function findOwnedByName(name, inventory) {
  const item = findItemByName(name, inventory);
  if (!item) {
    return 0;
  } else if ('count' in item) {
    return item.count;
  } else {
    // This is so we can use the same function for searching
    // for desired primes.
    return 1;
  }
}

function rarityToLevel(rarity) {
  const rarityDecoder = {
    "common": 1,
    "uncommon": 2,
    "rare": 3,
  }
  if (rarity in rarityDecoder) {
    return rarityDecoder[rarity];
  } else {
    return 0;
  }
}

function buildLastUpdated(...states) {
  let newLastUpdated = {'last_updated': {}};
  for (const state of states) {
    newLastUpdated['last_updated'] = Object.assign(
      newLastUpdated['last_updated'],
      state['last_updated']
    );
  }
  return newLastUpdated;
}

function buildBuildClickData(name, state) {
  let data = {
    "primes_inventory": [],
    "parts_inventory": [],
    "desired": [],
  }

  // Find the prime we're talking about.
  const prime = findItemByName(name, state.primes);
  if (prime === null) {
    throw new RangeError(`Could not find prime ${name}`);
  }

  // We have the prime data, but now we need the current inventory counts
  // for the prime and each part.
  const count = findOwnedByName(name, state.primes_inventory);
  data.primes_inventory.push({
    "name": name,
    "count": count+1,
  });
  // Part counts now.
  for (const c of prime.components) {
    const count = findOwnedByName(c.name, state.parts_inventory);
    data.parts_inventory.push({
      "name": c.name,
      "count": count-c.needed,
    });
  }

  // Finally, the desired payload.
  data.desired.push({
    "name": name,
    "is_desired": false,
  });

  return data;
}

function gatherSpareParts(primes, primesInventory, partsInventory, desired) {
  let spareParts = [];
  for (const part of partsInventory) {
    // We have 3 checks to perform:
    // 1) Is the corresponding prime owned?
    // 2) Is the corresponding prime desired?
    // 3) Do we have more parts than needed?

    // All 3 checks require finding the prime data first.
    let [prime, component] =
      findPrimeAndComponentFromPartName(part.name, primes);
    if (prime === null) {
      console.error("Failed to find prime corresponding to part %s",
        part.name);
      continue;
    }

    // 1) Check if the prime is owned.
    let owned = findOwnedByName(prime.name, primesInventory) > 0;

    // 2) Check if the prime is desired.
    let isDesired = findOwnedByName(prime.name, desired) > 0;

    // 3) Use the two previous checks to see if we need this part.
    let needed = 0;
    if (isDesired || !owned) {
      needed = component.needed;
    }

    // 3) Only add it to the list if we have spare parts.
    if (part.count > needed) {
      spareParts.push({
        part: part,
        needed: needed,
        ducats: component.ducats,
      });
    }
  }

  return spareParts;
}

function themeNameToPath(theme) {
  if (theme === "dark") {
    return "themes/dark.css";
  } else {
    return "themes/bland.css";
  }
}

export {
  findPrimeAndComponentFromPartName,
  findItemByName,
  findOwnedByName,
  rarityToLevel,
  buildLastUpdated,
  buildBuildClickData,
  gatherSpareParts,
  themeNameToPath,
}
