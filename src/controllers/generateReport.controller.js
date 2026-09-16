
import { LearningSession } from "../models/learningSession.model.js";
import { Explanation } from "../models/explaination.models.js";
import { SessionMessage } from "../models/sessionMessage.model.js";
import { Report } from "../models/report.model.js";
import { generateAIResponse } from "../services/ai.services.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asynchandler.js";
import { buildReportPrompt } from "../prompts/report.prompt.js"

const generateReport = asyncHandler( async (req, res) => {

    const { sessionId } = req.params;
    
    if(! sessionId){
        throw new ApiError(400, "Session ID is required")
    }

    const session = await LearningSession.findById(sessionId);

    if(!session) {
        throw new ApiError(404, "session not found");
    }
    if(session.user.toString() !== req.user._id.toString()){
        throw new ApiError(403,"You cannot generate a report for this session" )
    }
    if(session.status !== "completed"){
        throw new ApiError(400, "You cannot generate a report for this session")
    }

    const existingReport = await Report.findOne({
        session: session._id,
    });

    if(existingReport) {
        return res.status(200).json(
            new ApiResponse(
                200,
                existingReport,
                "Report already generated"
            )
        )
    }

    const explanation = await Explanation.findById(session.explanation);

    if (!explanation) {
        throw new ApiError(404, "Explanation not found");
    }
    

    // session messages fetch
    const sessionMessages = await SessionMessage.find({
        session: session._id,
    }).sort({
        createdAt: 1,
    })

    if(sessionMessages.length === 0){
        throw new ApiError(400, "No conversation messages found for this session");
    }

    // define conversation messages like AI, User
    const conversationTranscript = sessionMessages
    .map((message) => {
        const speaker = message.role === "user" ? "student" : "AI Coach";
        return `${speaker}: ${message.content}`;
    })
    .join("\n");

    const prompt = buildReportPrompt({
        topic: explanation.topic,
        initialExplanation: explanation.explanationText,
        conversationTranscript,
    });

    const aiResponse = await generateAIResponse(prompt);

    let reportData;

    try{
        reportData = JSON.parse(aiResponse);
    } catch (error) {
        throw new ApiError(
            502,
            "AI returned an invalid report format. please try again"
        )
    }

    const report = await Report.create({
        session : session._id,
        explanation : explanation._id,

        overallScore : reportData.overallScore,
        clarityScore : reportData.clarityScore,
        correctnessScore : reportData.correctnessScore,
        reasoningScore : reportData.reasoningScore,
        communicationScore: reportData.communicationScore,

        goodPoints: reportData.goodPoints,
        reasoningGaps: reportData.reasoningGaps,
        resolvedGaps: reportData.resolvedGaps,
        remainingGaps: reportData.remainingGaps,

        idealExplanation: reportData.idealExplanation,
        nextSteps: reportData.nextSteps,
    })

    return res.status(201).json(
        new ApiResponse(
            201,
            report,
            "Report generated successfully"
        )
    );

})


const getReport = asyncHandler(async (req, res) => {
    const { sessionId } = req.params;

    if (!sessionId) {
        throw new ApiError(400, "Session ID is required");
    }

    const session = await LearningSession.findById(sessionId);

    if (!session) {
        throw new ApiError(404, "Session not found");
    }

    if (session.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You cannot access this report");
    }

    const report = await Report.findOne({
        session: session._id,
    });

    if (!report) {
        throw new ApiError(404, "Report has not been generated yet");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            report,
            "Report fetched successfully"
        )
    );
});

export { generateReport , getReport};