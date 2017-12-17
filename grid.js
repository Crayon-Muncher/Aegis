const range = require('lodash/range')

const ROWS = 100
const COLS = 100

class Grid {
    constructor() {
        this.cells = range(ROWS).map(() => null)
    }
}

module.exports = Grid