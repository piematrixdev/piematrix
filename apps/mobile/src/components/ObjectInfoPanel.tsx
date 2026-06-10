import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { CloseCircle, Heart } from 'iconsax-react-native';
import { useFavorites } from '../favorites/FavoritesContext';
import StarGLOrb from './StarGLOrb';

export interface SelectedObject {
  type: string;
  name: string;
  magnitude?: number;
  ra?: number;
  dec?: number;
  spectralType?: string;
  extra?: string;
  constellation?: string;
  azimuth?: number;
  altitude?: number;
  distance?: number;
  spectralDesc?: string;
  spectralColor?: string;
  raFormatted?: string;
  decFormatted?: string;
  azFormatted?: string;
  altFormatted?: string;
}

interface Props {
  object: SelectedObject;
  onClose: () => void;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

export default function ObjectInfoPanel({ object, onClose }: Props) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const objectId = object.name;
  const favorited = isFavorite(objectId);
  const [wikiSummary, setWikiSummary] = useState<string | null>(null);
  const [wikiLoading, setWikiLoading] = useState(false);

  // Fetch Wikipedia summary when object changes
  useEffect(() => {
    setWikiSummary(null);
    setWikiLoading(true);

    // Build a search query appropriate for the object type
    const searchName = object.type === 'Star' && object.name.startsWith('HIP')
      ? `${object.name} star`
      : object.type === 'Constellation'
        ? `${object.name} constellation`
        : object.type === 'Deep Sky'
          ? object.name
          : `${object.name} ${object.type === 'Planet' ? 'planet' : object.type === 'Moon' ? '' : 'astronomy'}`;

    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(searchName)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.extract) {
          setWikiSummary(data.extract);
        } else {
          // Fallback: try just the name
          return fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(object.name)}`)
            .then(r => r.ok ? r.json() : null)
            .then(d => { if (d?.extract) setWikiSummary(d.extract); });
        }
      })
      .catch(() => {})
      .finally(() => setWikiLoading(false));
  }, [object.name]);

  const handleToggleFavorite = () => {
    toggleFavorite({
      id: objectId,
      name: object.name,
      type: object.type,
      magnitude: object.magnitude,
      constellation: object.constellation,
    });
  };

  return (
    <TouchableOpacity style={s.container} activeOpacity={1} onPress={onClose}>
      <View style={s.card}>
        {/* Edge highlights */}
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.5)', 'transparent']}
          locations={[0, 0.2, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={s.edgeTop}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.25)', 'rgba(255,255,255,0.06)', 'transparent']}
          locations={[0, 0.5, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.edgeLeft}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={s.edgeRight}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.2)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.cornerBloom}
        />

        <BlurView intensity={35} tint="dark" style={s.blur}>
          <View style={s.tint} />

          {/* Header */}
          <View style={s.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
              <StarGLOrb
                color={object.spectralColor ?? '#d4c5a0'}
                size={48}
              />
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{object.name}</Text>
                {object.spectralDesc && (
                  <Text style={[s.spectral, { color: object.spectralColor ?? '#e8dcc8' }]}>
                    {object.spectralDesc}
                  </Text>
                )}
                {object.extra && <Text style={s.extra}>{object.extra}</Text>}
              </View>
            </View>
            <View style={s.headerActions}>
              <TouchableOpacity
                onPress={handleToggleFavorite}
                style={s.favBtn}
                activeOpacity={0.7}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Heart
                  size={20}
                  color={favorited ? '#ef4444' : 'rgba(255,255,255,0.4)'}
                  variant={favorited ? 'Bold' : 'Linear'}
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ padding: 6 }}>
                <CloseCircle size={22} color="rgba(255,255,255,0.4)" variant="Bulk" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Badges */}
          <View style={s.badgeRow}>
            <View style={[s.badge, { backgroundColor: 'rgba(200,185,150,0.15)' }]}>
              <Text style={[s.badgeText, { color: '#e8dcc8' }]}>{object.type}</Text>
            </View>
            {object.constellation && (
              <View style={[s.badge, { backgroundColor: 'rgba(255,255,255,0.06)' }]}>
                <Text style={[s.badgeText, { color: 'rgba(255,255,255,0.6)' }]}>{object.constellation}</Text>
              </View>
            )}
            {favorited && (
              <View style={[s.badge, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Text style={[s.badgeText, { color: '#ef4444' }]}>Favorite</Text>
              </View>
            )}
          </View>

          <View style={s.sep} />

          {/* Details */}
          <View style={{ gap: 0 }}>
            {object.constellation && <InfoRow label="Constellation" value={object.constellation} />}
            {object.magnitude !== undefined && <InfoRow label="Magnitude" value={object.magnitude.toFixed(2)} />}
            {object.distance !== undefined && <InfoRow label="Distance" value={`~${object.distance.toLocaleString()} ly`} />}
            {object.spectralType && <InfoRow label="Sp Type" value={object.spectralType} />}
            {object.raFormatted && object.decFormatted && (
              <InfoRow label="RA / Dec" value={`${object.raFormatted}  ${object.decFormatted}`} />
            )}
            {object.azFormatted && object.altFormatted && (
              <InfoRow label="Az / Alt" value={`${object.azFormatted}  ${object.altFormatted}`} />
            )}
          </View>

          {/* Wikipedia summary */}
          {wikiLoading && (
            <View style={s.wikiSection}>
              <ActivityIndicator size="small" color="rgba(255,255,255,0.3)" />
            </View>
          )}
          {wikiSummary && (
            <View style={s.wikiSection}>
              <View style={s.sep} />
              <Text style={s.wikiText}>{wikiSummary}</Text>
              <Text style={s.wikiSource}>— Wikipedia</Text>
            </View>
          )}
        </BlurView>
      </View>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { position: 'absolute', bottom: 90, left: 14, right: 14 },
  card: { borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.7, shadowRadius: 28, elevation: 18 },
  edgeTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, zIndex: 3 },
  edgeLeft: { position: 'absolute', top: 0, left: 0, bottom: 0, width: 1, zIndex: 3 },
  edgeRight: { position: 'absolute', top: 0, right: 0, bottom: 0, width: 1, zIndex: 3 },
  cornerBloom: { position: 'absolute', top: 0, left: 0, width: 80, height: 80, borderTopLeftRadius: 16, zIndex: 3, opacity: 0.7 },
  blur: { padding: 18, borderRadius: 16, overflow: 'hidden' },
  tint: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(6,6,18,0.7)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  name: { color: '#fff', fontSize: 19, fontWeight: '700', fontFamily: 'Poppins-ExtraBold' },
  spectral: { fontSize: 12, fontFamily: 'Poppins-Regular', marginTop: 2, opacity: 0.85 },
  extra: { color: 'rgba(255,255,255,0.45)', fontSize: 12, fontFamily: 'Poppins-Light', marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  sep: { height: 0.5, backgroundColor: 'rgba(255,255,255,0.08)', marginBottom: 10 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  infoLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: 'Poppins-Light' },
  infoValue: { color: 'rgba(255,255,255,0.9)', fontSize: 13, fontWeight: '600', fontFamily: 'Poppins-Regular' },
  favBtn: { padding: 6 },
  wikiSection: { marginTop: 10 },
  wikiText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontFamily: 'Poppins-Light', lineHeight: 18 },
  wikiSource: { color: 'rgba(255,255,255,0.25)', fontSize: 10, fontFamily: 'Poppins-Light', marginTop: 6, textAlign: 'right' },
});
