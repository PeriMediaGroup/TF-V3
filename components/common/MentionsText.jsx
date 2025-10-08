import React from "react";
import { Text } from "react-native";
import { useNavigation } from "@react-navigation/native";

export default function MentionsText({ text, style, mentionStyle, hashtagStyle }) {
  const navigation = useNavigation();
  if (!text) return null;

  // Parse both @mentions and #hashtags
  const parts = [];
  const regex = /(@[A-Za-z0-9_.-]+|#[A-Za-z0-9_]+)/g;
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const token = match[0];
    if (token.startsWith("@")) {
      parts.push({ type: "mention", value: token, username: token.slice(1) });
    } else if (token.startsWith("#")) {
      parts.push({ type: "hashtag", value: token, tag: token.slice(1) });
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push({ type: "text", value: text.slice(lastIndex) });

  return (
    <Text style={style}>
      {parts.map((p, idx) => {
        if (p.type === "mention") {
          return (
            <Text
              key={`m-${idx}-${p.username}`}
              style={[style, mentionStyle, { textDecorationLine: "underline" }]}
              onPress={() =>
                navigation.navigate("Profile", {
                  screen: "PublicProfile",
                  params: { username: p.username },
                })
              }
            >
              {p.value}
            </Text>
          );
        }
        if (p.type === "hashtag") {
          return (
            <Text
              key={`h-${idx}-${p.tag}`}
              style={[style, hashtagStyle, { textDecorationLine: "underline" }]}
              onPress={() => navigation.navigate("Feed", { screen: "TaggedFeed", params: { tag: p.tag } })}
            >
              {p.value}
            </Text>
          );
        }
        return <Text key={`t-${idx}`}>{p.value}</Text>;
      })}
    </Text>
  );
}
