/*
 * This file is a bunch of helper methods for sifting through the various
 * state data in this frontend.
 */

function findPrimeAndComponentFromPartName(partName, primes) {
  for (const prime of primes) {
    for (const component of prime.components) {
      if (component.name === partName) {
        return [prime, component];
      }
    }
  }
  return null;
}

function findOwnedByName(name, inventory) {
  for (const item of inventory) {
    if (item.name === name) {
      if ('count' in item) {
        return item.count;
      } else {
        // This is so we can use the same function for searching
        // for desired primes.
        return 1;
      }
    }
  }
  return 0;
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

export {
  findPrimeAndComponentFromPartName,
  findOwnedByName,
  rarityToLevel,
}
