
import { Explanation } from "../models/explaination.models.js";
import { LearningSession } from "../models/learningSession.model.js";
import { SessionMessage } from "../models/sessionMessage.model.js";
import { generateAIResponse } from "../services/ai.services.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asynchandler.js";

const startSession = asyncHandler(async (req, res) => {

    const { explanationId, maxRounds} = req.body;
    if (!explanationId) {
        throw new ApiError(400, "Explanation ID is required");
    }

    
    const explanation = await Explanation.findById(explanationId);
    // validation 
    if(!explanation){
        throw new ApiError(404, "Explanation not found")
    }

    // ownership check 
    if(explanation.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "you connot start a session for this explanation")
    }

    

    // session create 

    const session  = await LearningSession.create({
        user: req.user._id,
        explanation: explanation._id,
        maxRounds: maxRounds || 3
    })

    // initial message create
    const userMessage = await SessionMessage.create({
        session: session._id,
        role: "user",
        messageType: "initial-explanation",
        content: explanation.explanationText,
        round: 0,
    });
    
    // AI prompt 
    const prompt = 
        `You are Socratic learning coach.
        
        Topic: 
        ${explanation.topic}
        
        student explanation:
        ${explanation.explanationText}
        
        Ask exactly one reasoning-based probing question
        Do not ask a simple definition question.
        Do not provide the answer.
        Return only the question.
        `;

    // service call
    const aiQuestion = await generateAIResponse(prompt);

    // AI question create
    const firstQuestion = await SessionMessage.create({
        session: session._id,
        role: "ai",
        messageType: "probe",
        content: aiQuestion.trim(),
        round: 1,
    });

    // response
    return res.status(201).json(
        new ApiResponse(
            201,
            {
            sessionId: session._id,
            status: session.status,
            currentRound: session.currentRound,
            maxRounds: session.maxRounds,
            firstMessage: firstQuestion,
            },
            "Learning session started successfully"
        )
    );


});

const sendSessionMessage = asyncHandler( async (req, res) => {

//    sessionId URL se lo
//    → message body se lo
//    → session database se find karo
//    → session exist check karo
//    → ownership check karo
//    → session active hai ya nahi check karo
//    → user message save karo
//    → currentRound increase karo
//    → dummy AI next question save karo
//    → response return karo

    const { sessionId} = req.params;
    const { content } = req.body;

    if(!sessionId){
        throw new ApiError(400, "session id required")
    }

    if(!content?.trim()){
        throw new ApiError(400, "message not found")
    }
    const session = await LearningSession.findById(sessionId);
    if(!session){
        throw new ApiError(404, "session  not found")
    }
    
    if(session.user.toString() !== req.user._id.toString()){
        throw new ApiError(403, "you cannot send the message")
    }

    if(session.status !== "active"){
        throw new ApiError(400, "session is not active");
    }

    const nextRound = session.currentRound + 1;

    const userMessage = await SessionMessage.create({
        session: session._id,
        role: "user",
        messageType: "answer",
        content: content.trim(),
        round: nextRound,
    })

    session.currentRound = nextRound;
    await session.save();

    if(session.currentRound >= session.maxRounds){
        session.status = "completed"
        await session.save();

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    sessionId: session._id,
                    status: session.status,
                    currentRound: session.currentRound,
                    userMessage
                },
                "Learning session completed successfully"
            )
        );
    }

    //  session history fetch 
    const messages = await SessionMessage.find({
        session: session._id,
    }).sort({ createdAt: 1 });

    const conversation = messages
        .map((message) => `${message.role}: ${message.content}`)
        .join("\n");

    //   gemini prompt
    const prompt = `
        You are a Socratic learning coach.

        Analyze the student's latest answer and the conversation below.

        Conversation:
        ${conversation}

        Rules:
        - Ask exactly one reasoning-based follow-up question.
        - Focus on why, how, logic, or an edge case.
        - Do not ask a basic definition question.
        - Do not provide the complete answer.
        - Return only the next question.
        `;
    
    // gemini calling

    const aiQuestion = await generateAIResponse(prompt);

    //
    const nextQuestion = await SessionMessage.create({
        session: session._id,
        role: "ai",
        messageType: "probe",
        content: aiQuestion.trim(),
        round: nextRound,
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                sessionId: session._id,
                status: session.status,
                currentRound: session.currentRound,
                userMessage,
                nextMessage: nextQuestion,
            },
            "Message saved successfully"
        )
    );
})

// complete session fetch
const getSession = asyncHandler(async (req, res) => {
    const session = await LearningSession.findById(req.params.sessionId)
        .populate("explanation", "topic");

    if (!session) {
        throw new ApiError(404, "Session not found");
    }

    if (session.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You cannot view this session");
    }

    return res.status(200).json(new ApiResponse(200, session, "Session fetched successfully"));
})

const getSessionMessages = asyncHandler(async (req, res) => {
    const session = await LearningSession.findById(req.params.sessionId);

    if (!session) {
        throw new ApiError(404, "Session not found");
    }

    if (session.user.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You cannot view these messages");
    }

    const messages = await SessionMessage.find({ session: session._id }).sort({ createdAt: 1 });
    return res.status(200).json(new ApiResponse(200, messages, "Messages fetched successfully"));
})




// history of user sessions

const getUserSessions = asyncHandler( async (req, res) => {
      
})



export { 
    startSession,
    sendSessionMessage,
    getSession,
    getSessionMessages,
    getUserSessions
};


