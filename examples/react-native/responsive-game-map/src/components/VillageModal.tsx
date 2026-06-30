import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import type { MapObject } from "../generateMapObjects";

interface VillageModalProps {
    item: MapObject | null;
    visible: boolean;
    onClose: () => void;
}

export function VillageModal({ item, visible, onClose }: VillageModalProps) {
    if (!item) return null;

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose}>
                <Pressable style={styles.modal} onPress={(e) => e.stopPropagation()}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>VILLAGE DETAILS</Text>
                        <Pressable style={styles.closeBtn} onPress={onClose}>
                            <Text style={styles.closeBtnText}>✕</Text>
                        </Pressable>
                    </View>

                    <View style={styles.content}>
                        <Row label="Player" value={item.playerName} />
                        <Row label="Village Name" value={item.villageName} />
                        <View style={styles.row}>
                            <Text style={styles.rowLabel}>Type</Text>
                            <Text style={styles.badge}>{item.type.toUpperCase()}</Text>
                        </View>
                        <View style={[styles.row, styles.rowLast]}>
                            <Text style={styles.rowLabel}>Coordinates</Text>
                            <Text style={styles.coords}>
                                {item.x} · {item.y}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.footer}>
                        <Pressable style={styles.primaryBtn} onPress={onClose}>
                            <Text style={styles.primaryBtnText}>CLOSE</Text>
                        </Pressable>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

function Row({ label, value }: { label: string; value: string }) {
    return (
        <View style={styles.row}>
            <Text style={styles.rowLabel}>{label}</Text>
            <Text style={styles.rowValue}>{value}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.7)",
    },
    modal: {
        width: 340,
        borderWidth: 2,
        borderColor: "rgba(16,185,129,0.5)",
        backgroundColor: "#18181b",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: "#3f3f46",
        backgroundColor: "#27272a",
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    headerTitle: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 1 },
    closeBtn: {
        height: 32,
        width: 32,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#52525b",
        backgroundColor: "#3f3f46",
    },
    closeBtnText: { color: "#a1a1aa", fontSize: 16 },
    content: { padding: 20, gap: 16 },
    row: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottomWidth: 1,
        borderBottomColor: "#3f3f46",
        paddingBottom: 12,
    },
    rowLast: { borderBottomWidth: 0, paddingBottom: 0 },
    rowLabel: { color: "#71717a", fontSize: 11, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase" },
    rowValue: { color: "#fff", fontSize: 14, fontWeight: "600" },
    badge: {
        color: "#34d399",
        borderWidth: 1,
        borderColor: "#059669",
        backgroundColor: "rgba(6,78,59,0.3)",
        paddingHorizontal: 12,
        paddingVertical: 4,
        fontSize: 11,
        fontWeight: "700",
    },
    coords: {
        color: "#fbbf24",
        borderWidth: 1,
        borderColor: "#52525b",
        backgroundColor: "#27272a",
        paddingHorizontal: 16,
        paddingVertical: 4,
        fontSize: 14,
        fontWeight: "700",
    },
    footer: {
        borderTopWidth: 1,
        borderTopColor: "#3f3f46",
        backgroundColor: "#27272a",
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    primaryBtn: {
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 2,
        borderColor: "#34d399",
        backgroundColor: "#059669",
    },
    primaryBtnText: { color: "#fff", fontSize: 14, fontWeight: "700", letterSpacing: 1 },
});
