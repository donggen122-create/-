// /api/* 로 들어오는 모든 요청을 작품 저장 API 로 보내요.
import { handleApi } from "../../src/api.js";

export const onRequest = ({ request, env }) => handleApi(request, env);
