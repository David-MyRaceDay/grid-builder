const WebpackObfuscator = require('webpack-obfuscator');

module.exports = {
    webpack: {
        configure: (webpackConfig, { env, paths }) => {
            // Only apply obfuscation in production
            if (env === 'production') {
                webpackConfig.plugins.push(
                    new WebpackObfuscator({
                        // Obfuscation options - React-friendly settings
                        rotateStringArray: true,
                        stringArray: true,
                        stringArrayThreshold: 0.5,
                        unicodeEscapeSequence: false,
                        
                        // Variable and function name obfuscation
                        identifierNamesGenerator: 'hexadecimal',
                        renameGlobals: false,
                        
                        // Reduced control flow obfuscation for React compatibility
                        controlFlowFlattening: false,
                        controlFlowFlatteningThreshold: 0,
                        
                        // Reduced dead code injection
                        deadCodeInjection: false,
                        deadCodeInjectionThreshold: 0,
                        
                        // Disable debugging protection that can interfere with React
                        debugProtection: false,
                        debugProtectionInterval: 0,
                        
                        // Keep console output for debugging if needed
                        disableConsoleOutput: false,
                        
                        // Domain lock (optional - can restrict to your domain)
                        // domainLock: ['grid-builder-33c3b.web.app'],
                        
                        // Reduce string splitting
                        splitStrings: false,
                        splitStringsChunkLength: 5,
                        
                        // Disable object key transformation (can break React)
                        transformObjectKeys: false,
                        
                        // Compact code
                        compact: true,
                        
                        // Reserved names to protect React internals
                        reservedNames: [
                            '^React',
                            '^react',
                            '^ReactDOM',
                            '^current',
                            '^useState',
                            '^useEffect',
                            '^useRef',
                            '^useCallback',
                            '^useMemo',
                            '^createContext',
                            '^forwardRef',
                            '^memo',
                            '^Component',
                            '^PureComponent'
                        ],
                        
                        // Reserved strings to protect React
                        reservedStrings: [
                            '^current$',
                            '^React',
                            '^react',
                            '^ReactDOM'
                        ],
                        
                        // Source map mode (disable for production)
                        sourceMap: false,
                        sourceMapMode: 'separate'
                    }, [
                        // Exclude files from obfuscation (if needed)
                        'excluded_bundle_name.js'
                    ])
                );
            }
            
            return webpackConfig;
        }
    }
};