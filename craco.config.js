const WebpackObfuscator = require('webpack-obfuscator');

module.exports = {
    webpack: {
        configure: (webpackConfig, { env, paths }) => {
            // Only apply obfuscation in production
            if (env === 'production') {
                webpackConfig.plugins.push(
                    new WebpackObfuscator({
                        // Obfuscation options
                        rotateStringArray: true,
                        stringArray: true,
                        stringArrayThreshold: 0.75,
                        unicodeEscapeSequence: false,
                        
                        // Variable and function name obfuscation
                        identifierNamesGenerator: 'hexadecimal',
                        renameGlobals: false,
                        
                        // Control flow obfuscation
                        controlFlowFlattening: true,
                        controlFlowFlatteningThreshold: 0.75,
                        
                        // Dead code injection
                        deadCodeInjection: true,
                        deadCodeInjectionThreshold: 0.4,
                        
                        // Debugging protection
                        debugProtection: true,
                        debugProtectionInterval: 2000,
                        
                        // Disable console output
                        disableConsoleOutput: true,
                        
                        // Domain lock (optional - can restrict to your domain)
                        // domainLock: ['grid-builder-33c3b.web.app'],
                        
                        // Split strings
                        splitStrings: true,
                        splitStringsChunkLength: 10,
                        
                        // Transform object keys
                        transformObjectKeys: true,
                        
                        // Compact code
                        compact: true,
                        
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