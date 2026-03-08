// FILE: /video-platform/contracts/rgbpp-royalty/src/lib.rs
// 功能说明：RGB++ 分账合约 Mock：根据比例计算分配并返回伪交易 ID。

pub struct Participant {
    pub address: String,
    pub ratio: f64,
}

pub struct DistributionOutput {
    pub address: String,
    pub amount_usdi: String,
}

pub fn distribute(video_id: &str, total_usdi: &str, participants: Vec<Participant>) -> (String, Vec<DistributionOutput>) {
    let total: f64 = total_usdi.parse().unwrap_or(0.0);
    let outputs: Vec<DistributionOutput> = participants
        .iter()
        .map(|p| DistributionOutput { address: p.address.clone(), amount_usdi: format!("{:.6}", total * p.ratio) })
        .collect();
    let tx_id = format!("rgbpp-{}-{}", video_id, outputs.len());
    (tx_id, outputs)
}