"use strict";

const { singleton, UniqueId } = require("./UniqueId");

module.exports = {
    uniqueId: singleton(),
    UniqueId
};
