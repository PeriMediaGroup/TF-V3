// screens/TermsScreen.jsx
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Colors, Fonts } from "../styles/GlobalStyles";
import { TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function TermsScreen() {
  const navigation = useNavigation();

  return (
    <View style={[styles.container, { backgroundColor: Colors.gunmetal }]}>
      {/* Header with back button + title */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: Colors.crimson }]}>
          Terms & Conditions
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Scrollable content */}
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.text, styles.sectionTitle]}>
          TriggerFeed Terms of Service
        </Text>

        <Text style={styles.text}>
          Welcome to TriggerFeed — a platform for freedom, fun, and firearms.
          Before you dive in, here's the deal:
        </Text>

        <Text style={styles.text}>
          By accessing or using our application, you agree to be bound by these
          Terms and Conditions and our Privacy Policy.
        </Text>

        <Text style={styles.sectionTitle}>Eligibility</Text>
        <Text style={styles.text}>
          You must be at least 18 years old to use TriggerFeed. By creating an
          account, you confirm that you meet this age requirement. Not us,
          that's the feds.
        </Text>

        <Text style={styles.sectionTitle}>User Conduct</Text>

        <Text style={styles.sectionSubTitle}>Be respectful</Text>
        <Text style={styles.text}>Don’t be a jerk. Seriously.</Text>

        <Text style={styles.sectionSubTitle}>No hate speech</Text>
        <Text style={styles.text}>
          Racism, sexism, threats, or targeted harassment? Get out.
        </Text>

        <Text style={styles.sectionSubTitle}>Keep it legal</Text>
        <Text style={styles.text}>
          No posting or promoting illegal activity. We're not going down for
          your bad decisions.
        </Text>

        <Text style={styles.sectionSubTitle}>
          Leave politics &amp; religion at the door
        </Text>
        <Text style={styles.text}>
          This isn’t the place for hot takes or holy wars (Try X for that).
        </Text>
        <Text style={styles.text}>
          You agree not to post harmful, offensive, or illegal content.
          Harassment, hate speech, and spamming are strictly prohibited.
          Violation may result in account suspension or removal.
        </Text>

        <Text style={styles.sectionTitle}>Content Ownership</Text>
        <Text style={styles.text}>
          You retain rights to the content you post but grant TriggerFeed a
          license to display and distribute your content on our platform. Do not
          post content you do not have the right to share.
        </Text>

        <Text style={styles.sectionTitle}>Privacy</Text>
        <Text style={styles.text}>
          We value your privacy. We don’t sell your data. Ever.
          We collect what we need to make the app work (like your email),
          and that's it. You may see some adds but that's how we keep the lights
          on.
        </Text>

        <Text style={styles.sectionTitle}>Termination</Text>
        <Text style={styles.text}>
          We reserve the right to suspend or terminate accounts that violate
          these Terms or engage in harmful activities.
        </Text>

        <Text style={styles.sectionTitle}>Have fun</Text>
        <Text style={styles.text}>
          Share cool gear, cool moments, and make some friends.
        </Text>

        <Text style={styles.sectionTitle}>PLEASE!!</Text>
        <Text style={styles.text}>
          • Follow local, state, and federal laws.{"\n"}• Be 18+{"\n"}• Accept
          that TriggerFeed can boot anyone violating these terms.
        </Text>

        <Text style={styles.sectionTitle}>Contact</Text>
        <Text style={styles.text}>
          For questions, please contact us at support@triggerfeed.com.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "space-between",
  },
  title: {
    fontFamily: Fonts.heading,
    fontSize: 20,
    textAlign: "center",
  },
  content: {
    padding: 20,
  },
  text: {
    color: Colors.white,
    fontSize: 16,
    marginBottom: 16,
    fontFamily: Fonts.body,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginTop: 12,
    marginBottom: 6,
    color: Colors.crimson,
  },
  sectionSubTitle: {
    fontSize: 16,
    fontWeight: "bold",
  },
});
