async function test() {
  const prompt = `Bạn là chuyên gia chấm thi môn Toán THPT. Hãy chấm bài làm sau theo rubric và trả về DUY NHẤT một JSON hợp lệ:

Đề bài: Giải phương trình log_5^2(x) + sqrt(log_5^2(x) + 1) - 3 = 0.
Rubric:
- Tiêu chí 1: Điều kiện xác định x > 0 (0.25đ)
- Tiêu chí 2: Đặt ẩn phụ t = sqrt(log_5^2(x) + 1) với t >= 1 (0.25đ)
- Tiêu chí 3: Giải phương trình t^2 + t - 4 = 0 tìm nghiệm t (0.25đ)
- Tiêu chí 4: Tìm x và kết luận tập nghiệm (0.25đ)

Bài làm học sinh Đinh Thị Việt Nga:
ĐKXĐ: x >= 0 (học sinh viết sai điều kiện)
Đặt t = sqrt(log_5^2(x) + 1), t >= 1
Phương trình trở thành: t^2 - 1 + t - 3 = 0 <=> t^2 + t - 4 = 0
Có: Delta = 1 - 4.(-4) = 17 > 0
t_1 = (-1 + sqrt(17))/2 (nhận vì > 1), t_2 = (-1 - sqrt(17))/2 (loại vì < 0)
Với t = (-1 + sqrt(17))/2 => log_5^2(x) + 1 = (18 - 2*sqrt(17))/4 = (9 - sqrt(17))/2
=> log_5^2(x) = (7 - sqrt(17))/2 > 0
=> log_5(x) = +- sqrt((7 - sqrt(17))/2)
=> x = 5^(+- sqrt((7 - sqrt(17))/2))
Kết luận: Tập nghiệm S = { 5^(sqrt((7 - sqrt(17))/2)), 5^(-sqrt((7 - sqrt(17))/2)) }

Hãy trả về duy nhất JSON có dạng:
{
  "score": 0.75,
  "maxScore": 1.0,
  "generalComment": "Học sinh giải tốt các bước biến đổi nhưng sai ĐKXĐ (x >= 0 thay vì x > 0)...",
  "strengths": ["Biến đổi ẩn phụ chính xác", "Khử nghiệm ngoại lai chuẩn"],
  "weaknesses": ["Sai điều kiện xác định của hàm logarit"],
  "criteriaBreakdown": [
    { "criterionId": "c1", "criterionName": "Điều kiện xác định", "maxPoints": 0.25, "awardedPoints": 0, "isCorrect": "wrong", "reason": "Học sinh viết x >= 0 thay vì x > 0" }
  ]
}`;

  const res = await fetch('https://claudecode.pimath.id.vn/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': 'sk-15c172aa4f3a8c2ef4b7f4c3171806b63166ee99990676e390d3525c',
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-opus-5',
      max_tokens: 2000,
      stream: false,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  const json = await res.json();
  console.log('STATUS:', res.status);
  console.log('RESULT:');
  console.log(json?.choices?.[0]?.message?.content);
}

test().catch(console.error);
