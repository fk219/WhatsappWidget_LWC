import lwc from '@lwc/rollup-plugin';
import replace from '@rollup/plugin-replace';
import alias from '@rollup/plugin-alias';
import { nodeResolve } from '@rollup/plugin-node-resolve';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    input: 'src/main.js',
    output: {
        file: 'dist/bundle.js',
        format: 'iife'
    },
    plugins: [
        alias({
            entries: [
                { find: 'lightning/platformShowToastEvent', replacement: path.resolve(__dirname, 'src/mocks/platformShowToastEvent.js') },
                { find: 'lightning/platformResourceLoader', replacement: path.resolve(__dirname, 'src/mocks/platformResourceLoader.js') }
            ]
        }),
        nodeResolve(),
        lwc(),
        replace({
            'process.env.NODE_ENV': JSON.stringify('development'),
            preventAssignment: true
        })
    ]
};
