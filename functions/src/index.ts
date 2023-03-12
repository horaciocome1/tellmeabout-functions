import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {Configuration, OpenAIApi} from "openai";

admin.initializeApp();

const firestore = admin.firestore();

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export const registerInstallation = functions.https.onCall(
  async (data, context) => {
    const installationId = data.installationId;

    if (context.auth == undefined) {
      return {
        success: false,
        errorMessage: "Not authenticated",
      };
    }

    const installationRef = firestore
      .collection("users")
      .doc(context.auth.uid);

    await installationRef.set({
      userid: context.auth.uid,
      installations: admin
        .firestore
        .FieldValue
        .arrayUnion(installationId),
      timestamp: admin
        .firestore
        .FieldValue
        .serverTimestamp(),
    });

    return {
      success: true,
    };
  }
);

export const generateFacts = functions.https.onCall(
  async (data, context) => {
    const topic = data.topic;
    const installationId = data.installationId;
    const count = data.count;

    if (context.auth == undefined) {
      return {
        success: false,
        errorMessage: "Not authenticated",
      };
    }

    const prompt = "Tell me " + count + " short, interesting, and " +
    "informative facts on " + topic;

    let completion;
    try {
      const temperature = data.temperature;

      completion = await openai.createCompletion({
        model: "text-davinci-003",
        prompt: prompt,
        temperature: temperature,
        max_tokens: 1000,
        presence_penalty: 1,
        user: context.auth.uid,
      });
    } catch (error) {
      console.log("Error while getting facts for topic=" + topic + " " +
      "installationId=" + installationId + " error=" + error);
      return {
        success: false,
        errorMessage: "OpenAI API error",
      };
    }

    if (completion.data.choices[0].text === undefined) {
      console.log("No facts found for topic=" + topic + " " +
      "installationId=" + installationId);
      return {
        success: false,
        errorMessage: "No facts found",
      };
    }

    const regex = RegExp("[\\n]|[0-9]?[0-9][.][ ]|\\n");

    const facts: string[] = completion.data.choices[0].text
      .split(regex)
      .filter((fact: string) => fact.length > 10);

    return {
      success: true,
      facts: facts,
    };
  }
);
