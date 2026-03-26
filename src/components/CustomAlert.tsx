import React, { useState, useCallback, useRef } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Animated, Platform,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm' | 'delete';

export type AlertButton = {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
};

export type AlertOptions = {
  type?: AlertType;
  title: string;
  message?: string;
  buttons?: AlertButton[];
};

// ─── Config ───────────────────────────────────────────────────────────────────

const CONFIG: Record<AlertType, { emoji: string; color: string; bg: string }> = {
  success: { emoji: '✅', color: '#059669', bg: '#ECFDF5' },
  error:   { emoji: '❌', color: '#DC2626', bg: '#FEF2F2' },
  warning: { emoji: '⚠️', color: '#D97706', bg: '#FFFBEB' },
  info:    { emoji: 'ℹ️', color: '#2563EB', bg: '#EFF6FF' },
  confirm: { emoji: '💬', color: '#6366F1', bg: '#EEF2FF' },
  delete:  { emoji: '🗑️', color: '#DC2626', bg: '#FEF2F2' },
};

// ─── Internal Modal Component ─────────────────────────────────────────────────

type ModalProps = {
  visible: boolean;
  options: AlertOptions;
  onDismiss: () => void;
};

function AlertModal({ visible, options, onDismiss }: ModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const { type = 'info', title, message, buttons } = options;
  const cfg = CONFIG[type];

  const resolvedButtons: AlertButton[] = buttons && buttons.length > 0
    ? buttons
    : [{ text: 'OK', style: 'default' }];

  const handleShow = () => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 180, friction: 12 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
  };

  const handlePress = (btn: AlertButton) => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 0.9, useNativeDriver: true, tension: 180, friction: 12 }),
      Animated.timing(opacityAnim, { toValue: 0, duration: 120, useNativeDriver: true }),
    ]).start(() => {
      onDismiss();
      btn.onPress?.();
    });
  };

  return (
    <Modal transparent visible={visible} onShow={handleShow} animationType="none" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}>
          {/* Icon blob */}
          <View style={[styles.iconBlob, { backgroundColor: cfg.bg }]}>
            <Text style={styles.iconEmoji}>{cfg.emoji}</Text>
          </View>

          {/* Text */}
          <Text style={[styles.title, { color: cfg.color }]}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}

          {/* Buttons */}
          <View style={[styles.btnRow, resolvedButtons.length === 1 && { justifyContent: 'center' }]}>
            {resolvedButtons.map((btn, i) => {
              const isDestructive = btn.style === 'destructive';
              const isCancel = btn.style === 'cancel';
              return (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.btn,
                    resolvedButtons.length === 1 && { flex: 0, paddingHorizontal: 40 },
                    isDestructive && styles.btnDestructive,
                    isCancel && styles.btnCancel,
                    !isDestructive && !isCancel && { backgroundColor: cfg.color },
                  ]}
                  onPress={() => handlePress(btn)}
                  activeOpacity={0.85}
                >
                  <Text style={[
                    styles.btnText,
                    isCancel && styles.btnTextCancel,
                    isDestructive && styles.btnTextDestructive,
                  ]}>
                    {btn.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCustomAlert() {
  const [visible, setVisible] = useState(false);
  const [opts, setOpts] = useState<AlertOptions>({ title: '', type: 'info' });

  const showAlert = useCallback((options: AlertOptions) => {
    setOpts(options);
    setVisible(true);
  }, []);

  const hideAlert = useCallback(() => setVisible(false), []);

  /** Drop this anywhere in your JSX return */
  const CustomAlert = () => (
    <AlertModal visible={visible} options={opts} onDismiss={hideAlert} />
  );

  return { showAlert, CustomAlert };
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 32,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16 },
      android: { elevation: 10 },
    }),
  },
  iconBlob: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconEmoji: { fontSize: 34 },
  title: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    marginBottom: 4,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 22,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnCancel: {
    backgroundColor: '#F3F4F6',
  },
  btnDestructive: {
    backgroundColor: '#FEE2E2',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  btnTextCancel: {
    color: '#374151',
  },
  btnTextDestructive: {
    color: '#DC2626',
  },
});
