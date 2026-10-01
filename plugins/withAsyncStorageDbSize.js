const { withGradleProperties } = require('@expo/config-plugins');

// AsyncStorage defaults to 6 MB on Android. BestForums keeps a local offline
// cache, so allow up to 100 MB while leaving actual disk-space enforcement to Android.
module.exports = function withAsyncStorageDbSize(config, sizeInMb = 100) {
  return withGradleProperties(config, (nextConfig) => {
    const key = 'AsyncStorage_db_size_in_MB';
    const current = nextConfig.modResults.find((item) => item.type === 'property' && item.key === key);
    if (current) current.value = String(sizeInMb);
    else nextConfig.modResults.push({ type: 'property', key, value: String(sizeInMb) });
    return nextConfig;
  });
};
