import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Accelerometer } from 'expo-sensors';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

const STORAGE_KEY = '@local_forum_demo_v1';
const TIME_ZONES = [
  { label: 'CST', zone: 'America/Chicago' }, { label: 'EST', zone: 'America/New_York' },
  { label: 'MST', zone: 'America/Denver' }, { label: 'PST', zone: 'America/Los_Angeles' }, { label: 'UTC', zone: 'UTC' },
];
const seedPosts = [{ id: 'welcome-post', author: 'Neighborhood Owl', anonymous: false, body: 'Welcome to the local-only forum demo. Shake your phone to jump to a random post.', createdAt: '2026-09-01T12:00:00.000Z', voters: [] }];
const profileKey = (name) => name.trim().toLowerCase();
const formatTime = (date, timeZone) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone }).format(new Date(date));
const locationName = (place) => [place.city || place.district, place.region, place.subregion].filter(Boolean).join(', ');

export default function App() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [posts, setPosts] = useState([]);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [draft, setDraft] = useState('');
  const [anonymous, setAnonymous] = useState(true);
  const [shareLocation, setShareLocation] = useState(false);
  const [timeZone, setTimeZone] = useState(TIME_ZONES[0]);
  const [highlightedPost, setHighlightedPost] = useState(null);
  const scrollView = useRef(null);
  const postOffsets = useRef({});
  const lastShake = useRef(0);

  useEffect(() => {
    async function restore() {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        setSession(data.session || null); setProfiles(data.profiles || []); setPosts(data.posts || seedPosts);
        setTimeZone(TIME_ZONES.find((item) => item.zone === data.timeZone) || TIME_ZONES[0]);
      } else setPosts(seedPosts);
      setReady(true);
    }
    restore().catch(() => { setPosts(seedPosts); setReady(true); });
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ session, profiles, posts, timeZone: timeZone.zone }));
  }, [ready, session, profiles, posts, timeZone]);

  useEffect(() => {
    if (!session) return undefined;
    Accelerometer.setUpdateInterval(250);
    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const force = Math.sqrt(x * x + y * y + z * z); const now = Date.now();
      if (force > 1.75 && now - lastShake.current > 1200) { lastShake.current = now; jumpToRandomPost(); }
    });
    return () => subscription.remove();
  }, [session, posts]);

  function signIn() {
    const displayName = username.trim();
    if (displayName.length < 2 || password.length < 4) { Alert.alert('Enter a username and password', 'Use at least 2 characters for a username and 4 for a password.'); return; }
    const profile = { id: profileKey(displayName), name: displayName };
    setProfiles((current) => current.some((item) => item.id === profile.id) ? current : [...current, profile]);
    setSession(profile); setPassword('');
  }

  async function publishPost() {
    const body = draft.trim(); if (!body) return;
    let location;
    if (shareLocation) {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') Alert.alert('Location unavailable', 'Your post will be published without a location.');
      else try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const [place] = await Location.reverseGeocodeAsync(position.coords);
        location = { latitude: position.coords.latitude, longitude: position.coords.longitude, name: place ? locationName(place) : 'Approximate location' };
      } catch { Alert.alert('Location unavailable', 'Your post will be published without a location.'); }
    }
    setPosts((current) => [{ id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, author: session.name, authorId: session.id, anonymous, body, createdAt: new Date().toISOString(), location, voters: [] }, ...current]);
    setDraft('');
  }

  function deletePost(id) {
    Alert.alert('Delete post?', 'This only removes it from this device.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => setPosts((current) => current.filter((post) => post.id !== id)) },
    ]);
  }

  function voteToDelete(post) {
    if (post.authorId === session.id) { Alert.alert('Your post', 'Authors cannot vote to delete their own posts.'); return; }
    const voters = post.voters.includes(session.id) ? post.voters.filter((id) => id !== session.id) : [...post.voters, session.id];
    if (voters.length >= 4) { setPosts((current) => current.filter((item) => item.id !== post.id)); Alert.alert('Post removed', 'Four local profiles voted to delete it.'); return; }
    setPosts((current) => current.map((item) => item.id === post.id ? { ...item, voters } : item));
  }

  function jumpToRandomPost() {
    if (!posts.length) return;
    const post = posts[Math.floor(Math.random() * posts.length)]; setHighlightedPost(post.id);
    const offset = postOffsets.current[post.id];
    if (offset !== undefined) scrollView.current?.scrollTo({ y: Math.max(0, offset - 12), animated: true });
    setTimeout(() => setHighlightedPost(null), 1400);
  }

  if (!ready) return <View style={styles.loading}><Text style={styles.muted}>Loading your local forum…</Text></View>;
  if (!session) return <SafeAreaView style={styles.screen}><StatusBar style="light" /><View style={styles.loginCard}>
    <Text style={styles.kicker}>LOCAL FORUM</Text><Text style={styles.title}>Say something.</Text><Text style={styles.muted}>This demo stores profiles and posts only on this phone.</Text>
    <TextInput value={username} onChangeText={setUsername} placeholder="Display username" placeholderTextColor="#718096" style={styles.input} autoCapitalize="words" />
    <TextInput value={password} onChangeText={setPassword} placeholder="Password (local demo)" placeholderTextColor="#718096" style={styles.input} secureTextEntry />
    <Pressable style={styles.primaryButton} onPress={signIn}><Text style={styles.primaryButtonText}>Create / sign in locally</Text></Pressable>
    <Text style={styles.note}>Google sign-in needs a real OAuth client and backend, so it is intentionally not simulated here.</Text>
  </View></SafeAreaView>;

  return <SafeAreaView style={styles.screen}><StatusBar style="light" /><ScrollView ref={scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><View><Text style={styles.kicker}>LOCAL FORUM</Text><Text style={styles.heading}>Hi, {session.name}</Text></View><Pressable onPress={() => setSession(null)}><Text style={styles.link}>Switch user</Text></Pressable></View>
    <Text style={styles.note}>Shake the phone to jump to a random post.</Text>
    <View style={styles.composer}>
      <TextInput value={draft} onChangeText={setDraft} placeholder="What is on your mind?" placeholderTextColor="#718096" style={styles.draft} multiline maxLength={600} />
      <View style={styles.settingRow}><Text style={styles.settingText}>Post anonymously</Text><Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ true: '#14b8a6' }} /></View>
      <View style={styles.settingRow}><Text style={styles.settingText}>Attach my location</Text><Switch value={shareLocation} onValueChange={setShareLocation} trackColor={{ true: '#14b8a6' }} /></View>
      <View style={styles.timeZones}>{TIME_ZONES.map((item) => <Pressable key={item.zone} onPress={() => setTimeZone(item)} style={[styles.zoneButton, timeZone.zone === item.zone && styles.zoneButtonActive]}><Text style={[styles.zoneText, timeZone.zone === item.zone && styles.zoneTextActive]}>{item.label}</Text></Pressable>)}</View>
      <Pressable style={[styles.primaryButton, !draft.trim() && styles.disabledButton]} onPress={publishPost} disabled={!draft.trim()}><Text style={styles.primaryButtonText}>Publish post</Text></Pressable>
    </View>
    <View style={styles.feedHeader}><Text style={styles.feedTitle}>Community feed</Text><Text style={styles.count}>{posts.length} posts</Text></View>
    {posts.map((post) => {
      const ownPost = post.authorId === session.id; const voted = post.voters.includes(session.id);
      return <View key={post.id} onLayout={(event) => { postOffsets.current[post.id] = event.nativeEvent.layout.y; }} style={[styles.post, highlightedPost === post.id && styles.highlightedPost]}>
        <View style={styles.postTop}><Text style={styles.author}>{post.anonymous ? 'Anonymous' : post.author}</Text><Text style={styles.timestamp}>{formatTime(post.createdAt, timeZone.zone)}</Text></View>
        <Text style={styles.body}>{post.body}</Text>
        {post.location && <View style={styles.location}><Text style={styles.locationText}>{post.location.latitude.toFixed(4)}, {post.location.longitude.toFixed(4)}</Text><Text style={styles.locationName}>{post.location.name}</Text></View>}
        <View style={styles.postActions}>{ownPost ? <Pressable onPress={() => deletePost(post.id)}><Text style={styles.deleteText}>Delete my post</Text></Pressable> : <Pressable onPress={() => voteToDelete(post)}><Text style={styles.voteText}>{voted ? 'Remove vote' : 'Vote to delete'} · {post.voters.length}/4</Text></Pressable>}{ownPost && <Text style={styles.count}>{post.voters.length}/4 votes</Text>}</View>
      </View>;
    })}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#111827' }, loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#111827' }, content: { padding: 18, paddingBottom: 42 }, header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }, kicker: { color: '#2dd4bf', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 }, heading: { color: '#f8fafc', fontSize: 28, fontWeight: '800', marginTop: 3 }, title: { color: '#f8fafc', fontSize: 34, fontWeight: '800', marginVertical: 8 }, muted: { color: '#94a3b8', fontSize: 15, lineHeight: 22 }, link: { color: '#5eead4', fontWeight: '700' }, note: { color: '#94a3b8', fontSize: 13, lineHeight: 19, marginTop: 10 }, loginCard: { margin: 22, marginTop: 120 }, input: { backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1, borderRadius: 10, color: '#f8fafc', fontSize: 16, marginTop: 16, padding: 14 }, primaryButton: { alignItems: 'center', backgroundColor: '#14b8a6', borderRadius: 10, marginTop: 16, padding: 14 }, disabledButton: { opacity: 0.45 }, primaryButtonText: { color: '#042f2e', fontSize: 16, fontWeight: '800' }, composer: { backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1, borderRadius: 14, marginTop: 16, padding: 14 }, draft: { color: '#f8fafc', fontSize: 16, minHeight: 84, textAlignVertical: 'top' }, settingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 }, settingText: { color: '#dbeafe', fontSize: 15 }, timeZones: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 14 }, zoneButton: { borderColor: '#475569', borderRadius: 18, borderWidth: 1, marginBottom: 6, marginRight: 6, paddingHorizontal: 10, paddingVertical: 6 }, zoneButtonActive: { backgroundColor: '#ccfbf1', borderColor: '#ccfbf1' }, zoneText: { color: '#cbd5e1', fontSize: 12, fontWeight: '700' }, zoneTextActive: { color: '#115e59' }, feedHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 8 }, feedTitle: { color: '#f8fafc', fontSize: 20, fontWeight: '800' }, count: { color: '#94a3b8', fontSize: 13 }, post: { backgroundColor: '#1f2937', borderColor: '#374151', borderWidth: 1, borderRadius: 14, marginTop: 10, padding: 15 }, highlightedPost: { borderColor: '#2dd4bf', borderWidth: 2 }, postTop: { flexDirection: 'row', justifyContent: 'space-between' }, author: { color: '#5eead4', fontSize: 15, fontWeight: '800' }, timestamp: { color: '#94a3b8', fontSize: 12, marginLeft: 12, textAlign: 'right' }, body: { color: '#f1f5f9', fontSize: 16, lineHeight: 23, marginTop: 11 }, location: { backgroundColor: 'rgba(148, 163, 184, 0.18)', borderRadius: 8, marginTop: 14, padding: 10 }, locationText: { color: '#cbd5e1', fontSize: 12, fontVariant: ['tabular-nums'] }, locationName: { color: '#e2e8f0', fontSize: 13, marginTop: 3 }, postActions: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 }, voteText: { color: '#fcd34d', fontWeight: '700' }, deleteText: { color: '#fca5a5', fontWeight: '700' },
});
