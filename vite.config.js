import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    // './' 로 두면 빌드 결과(dist)를 어느 주소 아래에 올려도 동작한다. (GitHub Pages 의 /저장소이름/ 같은 하위 경로 포함)
    base: './',
});
