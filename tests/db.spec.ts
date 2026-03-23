import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { clear, init, keys, read, remove, useDb, useDbPath, write } from '../src/db'
import { mkdtempSync, rmSync } from 'fs'

import path from 'path'
import { tmpdir } from 'os'

describe('Database Test', () => {
    const [_, setDbPath] = useDbPath()
    const [getDatabase, setDatabase] = useDb()
    const tempDbDir = mkdtempSync(path.join(tmpdir(), 'ghit-db-spec-'))

    setDbPath(tempDbDir)

    beforeAll(() => {
        setDatabase('testdb.db')
        init()
    })

    beforeEach(() => {
        clear()
    })

    afterAll(() => {
        getDatabase().close()
        rmSync(tempDbDir, { recursive: true, force: true })
    })

    it('should write and read data correctly', () => {
        write('key1', 'value1')
        const value = read('key1')
        expect(value).toBe('value1')
    })

    it('should remove data correctly', () => {
        write('key2', 'value2')
        remove('key2')
        const value = read('key2')
        expect(value).toBeNull()
    })

    it('should clear all data correctly', () => {
        write('key3', 'value3')
        write('key4', 'value4')
        clear()
        const value3 = read('key3')
        const value4 = read('key4')
        expect(value3).toBeNull()
        expect(value4).toBeNull()
    })

    it('should retrieve keys correctly', () => {
        write('keyA', 'valueA')
        write('keyB', 'valueB')
        const allKeys = keys()
        expect(allKeys).toContain('keyA')
        expect(allKeys).toContain('keyB')
    })
})