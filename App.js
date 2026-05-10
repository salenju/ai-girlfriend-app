import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function App() {
  const [courses, setCourses] = useState([
    { id: 1, name: "HTML" },
    { id: 2, name: "CSS" },
    { id: 3, name: "JavaScript" },
    { id: 4, name: "React" },
  ]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>欢迎来到你的AI 女友世界！</Text>
      {courses.map((course) => {
        return (
          <Text key={course.id} style={styles.item}>
            {course.name}
          </Text>
        );
      })}
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#f40",
  },
  item: {
    fontSize: 18,
    color: "#333",
    margin: 10,
    backgroundColor: "#eee",
  },
});
