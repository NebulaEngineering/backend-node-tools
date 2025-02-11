'use strict';

const fengari = require('fengari');
const { to_jsstring, to_luastring, lua, lauxlib, lualib } = fengari;



class Lua53Fengari {

    constructor() {
        this.L = lauxlib.luaL_newstate();
        lualib.luaL_openlibs(this.L);
    }

    static getLanguage() {
        return 'LUA'
    }

    static getVersion() {
        return 5.3;
    }


    /**
     * Load Lua script from a string.
     * This compiles and runs the chunk, so any global functions/variables
     * become available in the VM.
     * @param {string} source 
     */
    loadSource(source, otherSources = []) {
        let allSources = source;
        if(otherSources.length > 0){
            const sourceFn = source?.fn ?? 'exec';
            const sourceCode = source?.code ?? source;
            allSources = `
                modules = {}
                function createEnvironment(code)
                    local env = {}
                    setmetatable(env, { __index = _G })

                    local func, err = load(code, 'user_code', 't', env)
                    if not func then
                        return nil, err
                    end
                    return func, env
                end

                local func, env = createEnvironment([[${sourceCode}]])
                func()
                
                for key, value in pairs(env) do
                    if type(value) == "function" then
                        _G[key] = env[key]
                    end
                end
            `;

            allSources += Lua53Fengari.mergeCode(otherSources);
        }
        let status = lauxlib.luaL_loadstring(this.L, to_luastring(allSources));
        if (status !== lua.LUA_OK) {
            const errMsg = to_jsstring(lua.lua_tostring(L, -1));
            throw new Error("Lua53Fengari.loadSource: Error loading Lua script: " + errMsg);
        }

        const pcallStatus = lua.lua_pcall(this.L, 0, 0, 0);
        if (pcallStatus !== lua.LUA_OK) {
            const errMsg = to_jsstring(lua.lua_tostring(this.L, -1));
            lua.lua_pop(this.L, 1); // pop error
            throw new Error("Lua53Fengari.loadSource: Error running Lua chunk: " + errMsg);
        }
    }

    /**
     * Execute a named Lua function from the currently loaded script,
     * passing JS arguments (even nested objects/arrays) and returning
     * the Lua function's results converted back into JS.
     *
     * @param {Array<any>} args - arguments to pass (in the correct order)
     * @param {string} functionName - name of the Lua global function to call
     * @returns {any|any[]} - single value or array of values returned by the Lua function
     */
    execute(args = [], functionName = "exec") {
        // 1) Push the requested Lua function onto the stack
        lua.lua_getglobal(this.L, to_luastring(functionName));
        if (lua.lua_type(this.L, -1) !== lua.LUA_TFUNCTION) {
            lua.lua_pop(this.L, 1); // pop whatever is there
            throw new Error(`Lua53Fengari.execute: global function '${functionName}' not found or not a function.`);
        }

        // 2) Push arguments
        for (const arg of args) {
            Lua53Fengari.pushJsToLua(this.L, arg);
        }

        // 3) Call the function (args.length arguments, return all results)
        const callStatus = lua.lua_pcall(this.L, args.length, lua.LUA_MULTRET, 0);
        if (callStatus !== lua.LUA_OK) {
            const errMsg = to_jsstring(lua.lua_tostring(this.L, -1));
            lua.lua_pop(this.L, 1);
            throw new Error(`Lua53Fengari.execute: Error calling '${functionName}': ${errMsg}`);
        }

        // 4) Retrieve results from the top of the stack
        const numResults = lua.lua_gettop(this.L);
        if (numResults === 0) {
            // No return values
            return undefined;
        } else if (numResults === 1) {
            // Single return value
            const single = Lua53Fengari.luaToJs(this.L, -1);
            lua.lua_pop(this.L, 1);
            return single;
        } else {
            // Multiple return values -> collect them into an array
            let results = [];
            // Results are on the stack in the order they were returned, at positions 1..numResults.
            // However, indexing them in a loop requires offset handling:
            for (let i = 1; i <= numResults; i++) {
                // The index for `Lua53Fengari.luaToJs` is negative from the top: -numResults + (i-1)
                const value = Lua53Fengari.luaToJs(this.L, i - (numResults + 1));
                results.push(value);
            }
            lua.lua_pop(this.L, numResults);
            return results;
        }
    }

    /**
     * Asynchronous version of `execute()`: wraps the synchronous call in a Promise
     * so you can use `await` or `.then()` in JavaScript.
     *
     * @param {Array<any>} args - arguments to pass
     * @param {string} functionName - global function name
     * @returns {Promise<any|any[]>} - resolves with either a single JS value or array of JS values
     */
    execute$(args = [], functionName = "exec") {
        return new Promise((resolve, reject) => {
            try {
                const result = this.execute(args, functionName);
                resolve(result);
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Frees resources associated with the VM.
     */
    destroy() {
        // Free Lua state if possible
        if (this.L) {
            // For Fengari, there's no direct lua_close,
            // but set state to null to allow garbage collection
            this.L = null;
        }
    }




    //#region TOOLS

    static mergeCode(otherSources) {
        let code = '';
        otherSources.forEach((source, sourceIndex) => {
            const sourceCode = source?.code ?? source;
            const sourceKey = source?.key ?? `source${sourceIndex}`;
            code += `
                local func${sourceIndex}, env${sourceIndex} = createEnvironment([[${sourceCode}]])
                func${sourceIndex}()
                modules["${sourceKey}"] = env${sourceIndex}
            `;
        });

        return code;
    }

    /**
     * Recursively pushes a JS value onto the Lua stack.
     * - Strings, numbers, booleans, null/undefined -> direct push.
     * - Arrays, Objects -> pushed as Lua tables, recursing into their contents.
     */
    static pushJsToLua(L, value) {
        if (value === null || value === undefined) {
            lua.lua_pushnil(L);
        } else if (typeof value === 'string') {
            lua.lua_pushstring(L, to_luastring(value));
        } else if (typeof value === 'number') {
            lua.lua_pushnumber(L, value);
        } else if (typeof value === 'boolean') {
            lua.lua_pushboolean(L, value);
        } else if (Array.isArray(value)) {
            // Create a new Lua table for the array
            lua.lua_newtable(L);
            // Populate it (1-based indexing in Lua)
            value.forEach((item, i) => {
                lua.lua_pushnumber(L, i + 1);    // table index
                Lua53Fengari.pushJsToLua(L, item);           // push array item
                lua.lua_settable(L, -3);        // table[index] = item
            });
        } else if (typeof value === 'object') {
            // Create a new Lua table for the object
            lua.lua_newtable(L);
            for (const [k, v] of Object.entries(value)) {
                lua.lua_pushstring(L, to_luastring(k));
                Lua53Fengari.pushJsToLua(L, v);
                lua.lua_settable(L, -3);        // table[k] = v
            }
        } else {
            // Fallback for unrecognized types -> nil
            lua.lua_pushnil(L);
        }
    }

    /**
     * Recursively converts a Lua table (and nested structures) into a JS object/array.
     */
    static luaTableToJs(L, index) {
        // We'll check if all the keys are consecutive integers, which suggests an array
        let isArray = true;
        let obj = {};
        let arrayValues = [];

        // We will iterate once to detect if it *could be* an array
        // Then a second pass to actually build the final object.
        lua.lua_pushnil(L); // first key
        while (lua.lua_next(L, index - 1) !== 0) {
            // key is at -2, value at -1
            const keyType = lua.lua_type(L, -2);

            if (keyType === lua.LUA_TNUMBER) {
                // numeric key => potential array index
                const numKey = lua.lua_tonumber(L, -2);
                // We store in arrayValues, 1-based indexing => arrayValues[numKey - 1]
                arrayValues[numKey - 1] = null; // placeholder
            } else {
                // not a number => definitely not a pure array
                isArray = false;
            }
            lua.lua_pop(L, 1); // pop value, keep key for next iteration
        }

        // 2nd pass: build array or object
        lua.lua_pushnil(L);
        while (lua.lua_next(L, index - 1) !== 0) {
            const keyType = lua.lua_type(L, -2);
            let jsKey = null;
            if (keyType === lua.LUA_TNUMBER) {
                jsKey = lua.lua_tonumber(L, -2) - 1; // zero-based index in JS
            } else if (keyType === lua.LUA_TSTRING) {
                jsKey = to_jsstring(lua.lua_tostring(L, -2));
            } else {
                // fallback
                jsKey = String(lua.lua_tostring(L, -2));
            }

            // convert the value
            const val = Lua53Fengari.luaToJs(L, -1);

            if (isArray && typeof jsKey === 'number') {
                arrayValues[jsKey] = val;
            } else {
                obj[jsKey] = val;
            }

            lua.lua_pop(L, 1); // pop value
        }

        return isArray ? arrayValues : obj;
    }

    /**
     * Converts a single Lua value at `index` to a JS value.
     * - nil -> null
     * - string -> string
     * - number -> number
     * - boolean -> boolean
     * - table -> recursively convert to object/array
     * - anything else -> null (or handle more cases if needed)
     */
    static luaToJs(L, index) {
        const type = lua.lua_type(L, index);

        switch (type) {
            case lua.LUA_TNIL:
                return null;
            case lua.LUA_TSTRING:
                return to_jsstring(lua.lua_tostring(L, index));
            case lua.LUA_TNUMBER:
                return lua.lua_tonumber(L, index);
            case lua.LUA_TBOOLEAN:
                return lua.lua_toboolean(L, index);
            case lua.LUA_TTABLE:
                return Lua53Fengari.luaTableToJs(L, index);
            default:
                return null;
        }
    }

    //#endregion

}

module.exports = Lua53Fengari;